# Writes the step-2 D1 migrations from schema.src.sql: every "-- migration: <file>" section becomes
# <migrations dir>/<file>, with the "<column> GLOB @UUID@ / @TS@ / @DATE@" tokens expanded.
#   python3 -I gen_schema.py <schema.src.sql> <d1/migrations>          write the files
#   python3 -I gen_schema.py <schema.src.sql> <d1/migrations> --check  write nothing; exit 1 if a file differs
import os, re, sys

D = "[0-9]"
# D1 rejects a GLOB or LIKE pattern over 50 bytes ("LIKE or GLOB pattern too complex"), so the one-pattern
# forms of a uuid ([0-9a-f] x 32 with hyphens, 260 bytes) and a timestamp (107 bytes) are written as a
# conjunction of short GLOBs that accepts exactly the same strings (and NULL, as the single GLOB does).
D1_PATTERN_MAX = 50
# uuid: 36 characters with '-' at 9, 14, 19 and 24, only [0-9a-f-], and exactly those 4 hyphens.
UUID = ("({c} GLOB '????????-????-????-????-????????????' AND {c} NOT GLOB '*[^0-9a-f-]*'"
        " AND length(replace({c}, '-', '')) = 32)")
# 'YYYY-MM-DDTHH:MM:SS.ffffffZ': characters 1-10, 11-19 and 20 to the end.
TS = ("(substr({c}, 1, 10) GLOB '" + D*4 + "-" + D*2 + "-" + D*2 + "'"
      " AND substr({c}, 11, 9) GLOB 'T" + D*2 + ":" + D*2 + ":" + D*2 + "'"
      " AND substr({c}, 20) GLOB '." + D*6 + "Z')")
DATE = "{c} GLOB '" + D*4 + "-" + D*2 + "-" + D*2 + "'"
TOKENS = {"UUID": UUID, "TS": TS, "DATE": DATE}


def expand(text):
    text = re.sub(r"\b([a-z_]+) GLOB @(UUID|TS|DATE)@", lambda m: TOKENS[m.group(2)].format(c=m.group(1)), text)
    assert not re.search(r"@[A-Z]+@", text), "unexpanded token (a token must follow '<column> GLOB ')"
    for m in re.finditer(r"\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'", text, re.I):
        n = len(m.group(1).replace("''", "'").encode())
        assert n <= D1_PATTERN_MAX, "pattern of %d bytes, over the D1 limit: %s" % (n, m.group(1))
    return text
# A section starts at its banner: a "-- ====" line, the "-- migration:" line, the header comment lines
# that become the top of the file, and a closing "-- ====" line. It ends at the next banner.
BANNER = re.compile(r"^-- =+\n-- migration: (\d{4}_[a-z0-9_]+\.sql)\n((?:--(?: .*)?\n)*?)-- =+\n", re.M)
NOTICE = ("-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source\n"
          "-- and regenerate (check.py fails when they differ). Once applied to a remote database, never\n"
          "-- change this file; add a new migration section to the source instead.\n")


def render(src_text):
    """Returns {file name: file text} for every migration section of the source."""
    src_text = expand(src_text)
    marks = list(BANNER.finditer(src_text))
    assert marks, "no '-- migration:' section"
    files = {}
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(src_text)
        assert m.group(2), "migration %s has no header comment" % m.group(1)
        assert m.group(1) not in files, "duplicate migration " + m.group(1)
        files[m.group(1)] = m.group(2) + NOTICE + "\n" + src_text[m.end():end].strip("\n") + "\n"
    return files


def main():
    args = [a for a in sys.argv[1:] if a != "--check"]
    check = len(args) < len(sys.argv) - 1
    src, mig = args
    files = render(open(src, encoding="utf-8").read())
    differing = []
    for name, text in files.items():
        target = os.path.join(mig, name)
        current = open(target, encoding="utf-8").read() if os.path.exists(target) else None
        if current == text:
            continue
        differing.append(name)
        if not check:
            with open(target, "w", encoding="utf-8") as f:
                f.write(text)
    # A generated file whose section was renamed or removed would still be applied by wrangler.
    stale = sorted(f for f in os.listdir(mig) if f.endswith(".sql") and f not in files
                   and NOTICE.splitlines()[0] in open(os.path.join(mig, f), encoding="utf-8").read())
    if check:
        if differing or stale:
            print("migrations differ from %s: %s (run gen_schema.py without --check)%s" % (
                src, ", ".join(differing) or "none", "; generated files with no section: " + ", ".join(stale)
                if stale else ""))
            sys.exit(1)
        print("migrations match %s: %s" % (src, ", ".join(files)))
    else:
        print("wrote %d of %d migrations: %s" % (len(differing), len(files), ", ".join(differing) or "none changed"))
        if stale:
            print("generated files with no section (remove them by hand): " + ", ".join(stale))


if __name__ == "__main__":
    main()
