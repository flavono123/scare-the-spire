# Reads the plans of queries.sql from local D1 (workerd's SQLite), not from this computer's sqlite3.
# Run from the repo root after check.py (it compares with plans.txt):
#   python3 -I docs/supabase-exit/d1-schema/check-local-d1.py docs/supabase-exit/d1-schema
# Builds a throwaway local D1 (--persist-to a temp dir, never the default .wrangler state, never
# --remote): d1/migrations 0001..0006, then fixtures.sql. Every query becomes EXPLAIN QUERY PLAN with
# its params inlined as literals (wrangler d1 execute binds none), run in one --file --json call, and
# the detail lines go to check.py's judge(); once without statistics and once after ANALYZE. Writes
# plans-local-d1.txt, lists the queries whose plan differs from plans.txt, and exits 1 if a query
# misses its rule. D1 refuses sqlite_version(), so the SQLite version is read from the workerd binary.
import importlib.util, json, os, re, shutil, subprocess, sys, tempfile

D1 = PERSIST = check = None  # set by main()


def wrangler(*args):
    p = subprocess.run(["pnpm", "exec", "wrangler", "d1", *args, "--local", "--persist-to", PERSIST],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL)
    return p.returncode, p.stdout, p.stderr


def execute(sql=None, path=None):
    """Runs one command or one file on the throwaway D1; returns the per-statement results."""
    code, out, err = wrangler("execute", "DB", "--json", *(["--command", sql] if sql else ["--file", path]))
    start = min([i for i in (out.find("["), out.find("{")) if i >= 0] or [0])
    try:
        r = json.loads(out[start:])
    except ValueError:
        raise SystemExit("wrangler output is not JSON (exit %d):\n%s\n%s" % (code, out[-2000:], err[-2000:]))
    if isinstance(r, dict) or code != 0:
        raise RuntimeError(json.dumps(r)[:2000])
    return r


def literal(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, str):
        return "'" + v.replace("'", "''") + "'"
    raise TypeError("param of type %s" % type(v).__name__)


def inline(sql, params):
    """Replaces ?NNN / ? outside literals, quoted names and comments with the param as an SQL literal."""
    out, i, n, last = [], 0, len(sql), 0
    while i < n:
        c = sql[i]
        if c in "'\"`[":
            close = "]" if c == "[" else c
            j = i + 1
            while True:
                j = sql.index(close, j)
                if close != "]" and sql.startswith(close * 2, j):
                    j += 2
                    continue
                break
            out.append(sql[i:j + 1]); i = j + 1
        elif sql.startswith("--", i):
            j = sql.find("\n", i)
            j = n if j < 0 else j
            out.append(sql[i:j]); i = j
        elif sql.startswith("/*", i):
            j = sql.index("*/", i) + 2
            out.append(sql[i:j]); i = j
        elif c == "?":
            j = i + 1
            while j < n and sql[j].isdigit():
                j += 1
            k = int(sql[i + 1:j]) if j > i + 1 else last + 1
            last = max(last, k)
            out.append(literal(params[k - 1])); i = j
        elif c in ":@$" and i + 1 < n and (sql[i + 1].isalpha() or sql[i + 1] == "_"):
            raise ValueError("named parameter in: " + sql[:80])
        else:
            out.append(c); i += 1
    return "".join(out)


def sqlite_version():
    try:
        v = execute(sql="select sqlite_version() as v")[0]["results"][0]["v"]
        return v, "sqlite_version()"
    except RuntimeError as e:
        refused = json.loads(str(e)).get("error", {}).get("text", str(e))
    js = ("const w=require.resolve('wrangler/package.json');"
          "const m=require.resolve('miniflare/package.json',{paths:[w]});"
          "const k=require.resolve('workerd/package.json',{paths:[m]});"
          "console.log(require(k).version+'\\n'+require(require.resolve('workerd',{paths:[m]})).default)")
    wv, binary = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout.split("\n")[:2]
    data = open(binary, "rb").read()
    found = sorted({m.group(1).decode() for m in re.finditer(rb"[^0-9.](3\.\d{1,2}\.\d{1,2})\x00", data)})
    sid = re.search(rb"\x00(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [0-9a-f]{40})", data)
    version = found[0] if len(found) == 1 else "unknown (%s)" % ", ".join(found)
    return version, "workerd %s binary, source id %s...; D1 refuses sqlite_version(): %s" % (
        wv, sid.group(1).decode()[:40] if sid else "?", refused)


def reference_plans():
    """plans.txt (check.py, this computer's sqlite3) -> {pass label: [(status line, plan lines)]}."""
    passes, cur = {}, None
    for line in open(os.path.join(D1, "plans.txt"), encoding="utf-8").read().splitlines():
        m = re.match(r"== plans \((.*)\)$", line)
        if m:
            cur = passes.setdefault(m.group(1), [])
        elif cur is not None and (line.startswith("PASS ") or line.startswith("FAIL ")):
            cur.append((line, []))
        elif cur is not None and line.startswith("      ") and cur:
            cur[-1][1].append(line[6:])
        elif line.startswith("queries: "):
            cur = None
    return passes


def main():
    global D1, PERSIST, check
    D1 = sys.argv[1]  # docs/supabase-exit/d1-schema
    assert os.path.exists("wrangler.jsonc"), "run from the repo root"
    spec = importlib.util.spec_from_file_location("d1_schema_check", os.path.join(D1, "check.py"))
    check = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(check)
    PERSIST = tempfile.mkdtemp(prefix="d1-schema-local-")
    queries = check.parse_queries(open(os.path.join(D1, "queries.sql"), encoding="utf-8").read())
    ref = reference_plans()
    out = []
    try:
        code, so, se = wrangler("migrations", "apply", "DB")
        if code != 0:
            raise SystemExit("migrations apply failed:\n" + so[-2000:] + se[-2000:])
        applied = execute(sql="select group_concat(name, ', ') as m from (select name from d1_migrations order by id)")
        out.append("migrations: " + applied[0]["results"][0]["m"])
        fx = execute(path=os.path.join(D1, "fixtures.sql"))
        asserts = [list(r.values())[0] for s in fx for r in s["results"]]
        out.append("== fixtures: loaded (%d statements)" % len(fx))
        out += asserts
        version, source = sqlite_version()
        out.append("sqlite %s (%s)" % (version, source))
        schema = execute(sql="select (select count(*) from sqlite_schema where type='table' and name not glob 'sqlite_*'"
                             " and name not glob '_cf_*' and name <> 'd1_migrations') as t, (select count(*) from"
                             " sqlite_schema where type='index' and name not glob 'sqlite_autoindex_*') as i, (select"
                             " count(*) from sqlite_schema where type='trigger') as g, (select count(*) from"
                             " sqlite_schema where name = 'sqlite_stat1') as s")[0]["results"][0]
        out.append("tables %d, named indexes %d, triggers %d, sqlite_stat1 before ANALYZE: %d"
                   % (schema["t"], schema["i"], schema["g"], schema["s"]))
        eqp = os.path.join(PERSIST, "eqp.sql")
        with open(eqp, "w", encoding="utf-8") as f:
            for qid, expect, allow, params, sql in queries:
                f.write("EXPLAIN QUERY PLAN " + inline(sql, params) + ";\n")
        bad, differ = 0, {}
        for label, before in (("no statistics", None), ("after ANALYZE", "ANALYZE")):
            if before:
                execute(sql=before)
            results = execute(path=eqp)
            assert len(results) == len(queries), "%d results for %d queries" % (len(results), len(queries))
            ref_pass = ref.get(label, [])
            out.append("")
            out.append("== plans (%s)" % label)
            for k, ((qid, expect, allow, params, sql), res) in enumerate(zip(queries, results)):
                lines = [r["detail"] for r in res["results"]]
                problems = check.judge(qid, expect, allow, sql, lines)
                if problems:
                    bad += 1
                ref_lines = None
                if k < len(ref_pass) and re.match(r"(PASS|FAIL) " + re.escape(qid) + r"( |$)", ref_pass[k][0]):
                    ref_lines = ref_pass[k][1]
                same = ref_lines == lines
                if not same:
                    differ.setdefault(label, []).append(qid.split(" ")[0])
                note = (" allow=" + ",".join(allow)) if allow else ""
                out.append("%s %s%s [%s]%s" % ("PASS" if not problems else "FAIL", qid, note,
                                               "same as plans.txt" if same else "DIFFERS from plans.txt",
                                               ("  <- " + "; ".join(problems)) if problems else ""))
                out += ["      " + l for l in lines]
                if not same:
                    out += ["    plans.txt: " + l for l in (ref_lines if ref_lines is not None else ["(not found)"])]
        out.append("")
        out.append("queries: %d, rule failures (both passes): %d, plans different from plans.txt: %s"
                   % (len(queries), bad, "; ".join("%s %d (%s)" % (k, len(v), ", ".join(v)) for k, v in differ.items())
                      or "none"))
    finally:
        shutil.rmtree(PERSIST, ignore_errors=True)
    open(os.path.join(D1, "plans-local-d1.txt"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(out[-1])
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
