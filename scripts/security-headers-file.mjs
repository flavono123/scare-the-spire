// Reads the rule of a Cloudflare `_headers` file that applies to every path.
// `public/_headers` is the checked-in copy of workers/security-headers.ts.
export const PUBLIC_HEADERS_FILE = "public/_headers";

const GLOBAL_RULE_PATTERN = "/*";

/** The rule as its original lines: the path pattern, then each indented header. */
export function globalHeaderRuleLines(text) {
  const lines = text.split("\n");
  const start = lines.indexOf(GLOBAL_RULE_PATTERN);
  if (start < 0) throw new Error(`Missing the ${GLOBAL_RULE_PATTERN} rule`);

  const rule = [lines[start]];
  for (let index = start + 1; /^\s+\S/.test(lines[index] ?? ""); index += 1) {
    rule.push(lines[index]);
  }
  return rule;
}

/** The rule's headers as [name, value] pairs, in file order. */
export function globalHeaders(text) {
  return globalHeaderRuleLines(text).slice(1).map((line) => {
    const header = line.trim();
    const separator = header.indexOf(":");
    if (separator < 0) throw new Error(`Malformed header line: ${header}`);
    return [header.slice(0, separator).trim(), header.slice(separator + 1).trim()];
  });
}
