# Writes the step-2 D1 migrations from schema.src.sql: every "-- migration: <file>" section becomes
# <migrations dir>/<file>, with the @UUID@ / @TS@ / @DATE@ tokens expanded to GLOB patterns.
#   python3 -I gen_schema.py <schema.src.sql> <d1/migrations>          write the files
#   python3 -I gen_schema.py <schema.src.sql> <d1/migrations> --check  write nothing; exit 1 if a file differs
import os, re, sys

H = "[0-9a-f]"
D = "[0-9]"
TOKENS = {
    "@UUID@": "'" + "-".join(H * n for n in (8, 4, 4, 4, 12)) + "'",
    "@TS@": "'" + D*4 + "-" + D*2 + "-" + D*2 + "T" + D*2 + ":" + D*2 + ":" + D*2 + "." + D*6 + "Z'",
    "@DATE@": "'" + D*4 + "-" + D*2 + "-" + D*2 + "'",
}
# A section starts at its banner: a "-- ====" line, the "-- migration:" line, the header comment lines
# that become the top of the file, and a closing "-- ====" line. It ends at the next banner.
BANNER = re.compile(r"^-- =+\n-- migration: (\d{4}_[a-z0-9_]+\.sql)\n((?:--(?: .*)?\n)*?)-- =+\n", re.M)
NOTICE = ("-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source\n"
          "-- and regenerate (check.py fails when they differ). Once applied to a remote database, never\n"
          "-- change this file; add a new migration section to the source instead.\n")


def render(src_text):
    """Returns {file name: file text} for every migration section of the source."""
    for token, pattern in TOKENS.items():
        src_text = src_text.replace(token, pattern)
    assert not re.search(r"@[A-Z]+@", src_text), "unexpanded token"
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
    if check:
        if differing:
            print("migrations differ from %s: %s (run gen_schema.py without --check)" % (src, ", ".join(differing)))
            sys.exit(1)
        print("migrations match %s: %s" % (src, ", ".join(files)))
    else:
        print("wrote %d of %d migrations: %s" % (len(differing), len(files), ", ".join(differing) or "none changed"))


if __name__ == "__main__":
    main()
