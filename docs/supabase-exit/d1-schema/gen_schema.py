# Expands the @UUID@ / @TS@ / @DATE@ tokens of schema.src.sql into schema.sql.
import sys
src, out = sys.argv[1], sys.argv[2]
H = "[0-9a-f]"
D = "[0-9]"
UUID = "'" + "-".join(H * n for n in (8, 4, 4, 4, 12)) + "'"
TS = "'" + D*4 + "-" + D*2 + "-" + D*2 + "T" + D*2 + ":" + D*2 + ":" + D*2 + "." + D*6 + "Z'"
DATE = "'" + D*4 + "-" + D*2 + "-" + D*2 + "'"
text = open(src, encoding="utf-8").read()
text = text.replace("@UUID@", UUID).replace("@TS@", TS).replace("@DATE@", DATE)
import re; assert not re.search(r"@[A-Z]+@", text), "unexpanded token"
open(out, "w", encoding="utf-8").write(text)
