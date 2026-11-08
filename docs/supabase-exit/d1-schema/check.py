# Checks the step-2 D1 schema. Confirms d1/migrations matches schema.src.sql (gen_schema.py --check),
# builds a fresh check.db from every d1/migrations/*.sql in order (0001..0006, foreign keys on), loads
# fixtures.sql, runs the CHECK/FK probes, then EXPLAIN QUERY PLAN for every query in queries.sql, twice:
# without statistics and after ANALYZE. Writes plans.txt and exits non-zero if any query misses its rule.
# parse_queries() and judge() are shared with check-local-d1.py, which reads the same plans from local D1.
import json, os, re, sqlite3, subprocess, sys, tempfile


def parse_queries(text):
    """queries.sql -> [(id, expect, allow, params, sql)] in file order."""
    blocks = re.split(r"^-- @ ", text, flags=re.M)[1:]
    queries = []
    for b in blocks:
        header, _, body = b.partition("\n")
        parts = [p.strip() for p in header.split(" | ")]
        qid = parts[0]
        meta = dict(p.split("=", 1) for p in parts[1:])
        sql = "\n".join(l for l in body.splitlines() if not l.startswith("--")).strip().rstrip(";")
        queries.append((qid, [e for e in meta.get("expect", "").split(",") if e],
                        [a for a in meta.get("allow", "").split(",") if a], json.loads(meta.get("params", "[]")), sql))
    return queries


def judge(qid, expect, allow, sql, lines):
    problems = []
    for e in expect:
        alias, token = e.split(":", 1)
        tokens = ("PRIMARY KEY", "sqlite_autoindex_") if token == "PK" else (token,)
        hit = [l for l in lines if re.match(r"(SEARCH|SCAN) %s( |$)" % re.escape(alias), l)
               and any(t in l for t in tokens)]
        if not hit:
            problems.append("expected %s using %s" % (alias, token))
    has_limit = re.search(r"\bLIMIT\b", sql, re.I) is not None
    # Names that are temporary results (CTEs, derived tables), not stored tables.
    temps = {m.group(2) for l in lines for m in [re.match(r"(MATERIALIZE|CO-ROUTINE) (\S+)", l)] if m}
    for l in lines:
        # Every service table and child table key starts with the constant service column, so a degraded
        # plan shows up as SEARCH ... (service=?) rather than SCAN: it reads every row of that service.
        # On the primary key that is always a full read of the service; on a secondary index it is an
        # ordered walk, fine only under a LIMIT (the feeds walk posts_service_* and stop at 20).
        # Newer SQLite (local D1's 3.53.4) writes an EXISTS probe as "SEARCH <alias> EXISTS USING ...".
        m = re.match(r"SEARCH (\S+) (?:EXISTS )?USING (COVERING )?(PRIMARY KEY|INDEX \S+) \(service=\?\)$", l)
        if m:
            alias, on_pk = m.group(1), m.group(3) == "PRIMARY KEY"
            if "svcrange:" + alias not in allow and (on_pk or (not has_limit and "walk" not in allow)):
                problems.append("service-prefix-only search (reads the whole service) on " + alias)
        m = re.match(r"SCAN (\S+)(.*)$", l)
        if m:
            alias, rest = m.group(1), m.group(2)
            if "VIRTUAL TABLE" in rest or alias in ("CONSTANT",) or alias in temps or alias.startswith("(subquery"):
                continue
            if "USING" not in rest:
                if "scan:" + alias not in allow:
                    problems.append("full scan of " + alias)
            elif not has_limit and "walk" not in allow:
                problems.append("index walk without LIMIT on " + alias)
        if "USE TEMP B-TREE FOR ORDER BY" in l or "USE TEMP B-TREE FOR LAST" in l or "USE TEMP B-TREE FOR RIGHT PART" in l:
            if "tempsort" not in allow:
                problems.append("temp B-tree for ORDER BY")
        if "USE TEMP B-TREE FOR GROUP BY" in l or "USE TEMP B-TREE FOR DISTINCT" in l:
            if "tempgroup" not in allow:
                problems.append(l.strip())
    return problems


def main():
    D1 = sys.argv[1]            # docs/supabase-exit/d1-schema
    MIG = sys.argv[2]           # repo d1/migrations
    gen = subprocess.run([sys.executable, "-I", os.path.join(D1, "gen_schema.py"),
                          os.path.join(D1, "schema.src.sql"), MIG, "--check"], capture_output=True, text=True)
    if gen.returncode != 0:
        print((gen.stdout + gen.stderr).strip())
        sys.exit(1)
    migrations = sorted(f for f in os.listdir(MIG) if re.fullmatch(r"[0-9]{4}_[a-z0-9_]+\.sql", f))
    db_path = os.path.join(tempfile.mkdtemp(prefix="d1-schema-check-"), "check.db")
    ddl = "PRAGMA foreign_keys=ON;\n" + "\n".join(
        open(os.path.join(MIG, f), encoding="utf-8").read() for f in migrations)
    subprocess.run(["sqlite3", "-bail", db_path], input=ddl.encode(), check=True)
    fx = subprocess.run(["sqlite3", "-bail", db_path],
                        input=("PRAGMA foreign_keys=ON;\n" + open(os.path.join(D1, "fixtures.sql"), encoding="utf-8").read()).encode(),
                        capture_output=True)
    out = []
    out.append("== fixtures: " + ("loaded" if fx.returncode == 0 else "FAILED"))
    out.append(fx.stdout.decode().strip())
    out.append("migrations (%d): %s" % (len(migrations), ", ".join(migrations)))
    if fx.returncode != 0:
        print(fx.stderr.decode())
        sys.exit(1)

    con = sqlite3.connect(db_path, isolation_level=None)
    con.execute("PRAGMA foreign_keys = ON")
    out.append("sqlite " + con.execute("select sqlite_version()").fetchone()[0])
    counts = con.execute("""select group_concat(name || '=' || n, ', ') from (
      select name, 0 as n from sqlite_schema where 0)""").fetchone()
    tables = [r[0] for r in con.execute(
        "select name from sqlite_schema where type='table' and name not like 'sqlite_%' order by name")]
    out.append("tables (%d): %s" % (len(tables), ", ".join(
        "%s=%d" % (t, con.execute('select count(*) from "%s"' % t).fetchone()[0]) for t in tables)))

    # ---------------------------------------------------------------- CHECK / FK probes (must fail)
    UUID1 = "11111111-1111-4111-8111-111111111111"
    probes = [
        ("timestamp without 6 fraction digits",
         "INSERT INTO likes VALUES ('k', ?, '2026-11-05T11:48:12.345Z')", [UUID1]),
        ("timestamp with +00:00 offset",
         "INSERT INTO likes VALUES ('k', ?, '2026-11-05T11:48:12.345600+00:00')", [UUID1]),
        ("uppercase uuid",
         "INSERT INTO likes VALUES ('k', ?, '2026-11-05T11:48:12.345600Z')", [UUID1.upper().replace("1", "A")]),
        ("STRICT: text in an INTEGER column",
         "INSERT INTO threads (thread_key, like_count) VALUES ('k2', 'many')", []),
        ("FK: comment like without its comment",
         "INSERT INTO comment_likes VALUES ('c7777777-0000-4000-8000-000000000001', ?, '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("FK: service row without its post",
         "INSERT INTO post_pagestorm (post_id, content, content_text) VALUES ('a7777777-0000-4000-8000-000000000001', '{}', 'x')", []),
        ("FK: service row under a post of another service (the transfigure post's id as a combo)",
         "INSERT INTO post_combo (post_id, content, content_text) VALUES ('a0000000-0000-4000-8000-000000000003', '[]', 'xx')", []),
        ("service column with another service's value",
         "INSERT INTO post_combo (service, post_id, content, content_text) VALUES ('transfigure', 'a0000000-0000-4000-8000-000000000003', '[]', 'xx')", []),
        ("FK: this-or-that like for a missing post (step 5 answers not_found)",
         "INSERT INTO this_or_that_post_likes (post_id, user_id, created_at) VALUES ('a7777777-0000-4000-8000-00000000000b', ?, '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("posts: second row with the same (service, id)",
         "INSERT INTO posts (service, id, user_id, nickname, summary, created_at) VALUES ('combo', '00000009-0000-4000-8000-000000000009', ?, 'n', 's', '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("posts: uuid service with a run-shaped id",
         "INSERT INTO posts (id, service, user_id, nickname, summary, created_at) VALUES ('r1', 'combo', ?, 'n', 's', '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("posts: owner-less combo",
         "INSERT INTO posts (id, service, user_id, nickname, summary, created_at) VALUES ('a7777777-0000-4000-8000-000000000002', 'combo', NULL, 'n', 's', '2026-11-05T11:48:12.345600Z')", []),
        ("posts: title on a service without one",
         "INSERT INTO posts (id, service, user_id, nickname, title, summary, created_at) VALUES ('a7777777-0000-4000-8000-000000000003', 'combo', ?, 'n', 't', 's', '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("posts: board summary over 120 chars",
         "INSERT INTO posts (id, service, user_id, nickname, summary, created_at) VALUES ('a7777777-0000-4000-8000-000000000004', 'combo', ?, 'n', ?, '2026-11-05T11:48:12.345600Z')", [UUID1, "x" * 121]),
        ("run summary_version > 0 without the summary",
         "INSERT INTO post_history_course (post_id, seed, build, \"character\", ascension, win, acts_count, summary_version) VALUES ('r00000000000000f', 's', 'b', 'c', 0, 0, 3, 1)", []),
        ("run list_facts that is not a JSON object",
         "UPDATE post_history_course SET list_facts = '[]' WHERE post_id = '0a1b2c3d4e5f6g7h'", []),
        ("tournament play with wrong match count",
         "INSERT INTO favorite_tournament_plays (id, tournament_id, user_id, starting_size, champion_type, champion_id, matches, created_at) VALUES ('f7777777-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', ?, 4, 'relic', 'anchor', '[]', '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("philosopher week_start not a Monday",
         "INSERT INTO colorful_philosopher_posts (id, week_start, slot, resource_type, resource_id, name_ko, name_en, body, game_version, created_at) VALUES ('d7777777-0000-4000-8000-000000000001', '2026-11-03', 'card', 'card', 'x', 'x', 'x', 'x', '1', '2026-11-05T11:48:12.345600Z')", []),
        ("outbox op outside the enum",
         "INSERT INTO outbox (table_name, op, match_key, created_at) VALUES ('t', 'merge', '{}', 1)", []),
        ("posts: run id over 1024 bytes (runs_key_size_check)",
         "INSERT INTO posts (id, service, user_id, nickname, summary, created_at) VALUES (?, 'history_course', ?, 'n', 's', '2026-11-05T11:48:12.345600Z')", ["r" * 1025, UUID1]),
        ("posts: service id that is not a lowercase identifier",
         "INSERT INTO posts (id, service, user_id, nickname, summary, created_at) VALUES ('a7777777-0000-4000-8000-000000000006', 'Combo Posts', ?, 'n', 's', '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("sync_state: high_seen below low_watermark",
         "UPDATE sync_state SET low_watermark = 10, high_seen = 5 WHERE name = 'supabase_in'", []),
        ("sync_rejects: second open reject for the same key",
         "INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, payload, error, first_at, last_at) VALUES ('in', 42, 'comments', 'comments', '{\"id\":\"c0000000-0000-4000-8000-000000000041\"}', 'U', '{}', 'e', 1, 1)", []),
    ]
    accepts = [
        ("1-char comment Supabase accepts",
         "INSERT INTO comments (id, story_id, user_id, nickname, content, created_at) VALUES ('c7777777-0000-4000-8000-000000000009', 'k', ?, 'n', 'x', '2026-11-05T11:48:12.000000Z')", [UUID1]),
        ("builtin tournament without an owner",
         "INSERT INTO posts (id, service, user_id, nickname, title, summary, created_at) VALUES ('a7777777-0000-4000-8000-000000000009', 'favorite_tournament', NULL, '세 번째 손', 't', 't', '2026-11-05T11:48:12.000000Z')", []),
        ("run id Supabase accepts in any shape, even a Toy Box post's uuid (key is (service, id))",
         "INSERT INTO posts (id, service, user_id, nickname, summary, created_at) VALUES ('a0000000-0000-4000-8000-000000000003', 'history_course', ?, 'n', 's', '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("run whose donor was removed (ON DELETE SET NULL)",
         "INSERT INTO posts (id, service, user_id, nickname, summary, created_at) VALUES ('q000000000000001', 'history_course', NULL, ' 닉 ', 's', '2026-11-05T11:48:12.000000Z')", []),
        ("STRICT: integral REAL into INTEGER is converted",
         "INSERT INTO threads (thread_key, like_count) VALUES ('k3', 2.0)", []),
        ("empty thread key Supabase accepts (octet_length <= 1024 only)",
         "INSERT INTO likes VALUES ('', ?, '2026-11-05T11:48:12.345600Z')", [UUID1]),
        ("a future Toy Box service: uuid id, owner, optional title (no rebuild needed)",
         "INSERT INTO posts (id, service, user_id, nickname, title, summary, created_at) VALUES ('a7777777-0000-4000-8000-000000000007', 'new_service', ?, 'n', 't', 's', '2026-11-05T11:48:12.345600Z')", [UUID1]),
    ]
    out.append("")
    out.append("== CHECK / FK probes")
    bad = 0
    for name, sql, params in probes:
        con.execute("SAVEPOINT p")
        try:
            con.execute(sql, params)
            out.append("FAIL (accepted) " + name)
            bad += 1
        except sqlite3.DatabaseError as e:
            out.append("ok   rejected: %s -> %s" % (name, e))
        con.execute("ROLLBACK TO p"); con.execute("RELEASE p")
    for name, sql, params in accepts:
        con.execute("SAVEPOINT p")
        try:
            con.execute(sql, params)
            out.append("ok   accepted: " + name)
        except sqlite3.DatabaseError as e:
            out.append("FAIL (rejected) %s -> %s" % (name, e))
            bad += 1
        con.execute("ROLLBACK TO p"); con.execute("RELEASE p")

    # ---------------------------------------------------------------- queries
    queries = parse_queries(open(os.path.join(D1, "queries.sql"), encoding="utf-8").read())

    def plan_lines(sql, params):
        return [r[3] for r in con.execute("EXPLAIN QUERY PLAN " + sql, params)]

    def run_all(label):
        nonlocal bad
        out.append("")
        out.append("== plans (%s)" % label)
        for qid, expect, allow, params, sql in queries:
            lines = plan_lines(sql, params)
            problems = judge(qid, expect, allow, sql, lines)
            con.execute("SAVEPOINT q")
            try:
                rows = con.execute(sql, params).fetchall()
                ran = "ran, %d row(s)" % len(rows)
            except sqlite3.DatabaseError as e:
                ran = "ERROR " + str(e)
                problems.append("execution failed")
            con.execute("ROLLBACK TO q"); con.execute("RELEASE q")
            status = "PASS" if not problems else "FAIL"
            if problems:
                bad += 1
            note = (" allow=" + ",".join(allow)) if allow else ""
            out.append("%s %s%s [%s]%s" % (status, qid, note, ran, ("  <- " + "; ".join(problems)) if problems else ""))
            for l in lines:
                out.append("      " + l)

    run_all("no statistics")
    con.execute("ANALYZE")
    run_all("after ANALYZE")
    out.append("")
    out.append("queries: %d, failures (probes + plans, both passes): %d" % (len(queries), bad))
    open(os.path.join(D1, "plans.txt"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    print("queries", len(queries), "failures", bad)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
