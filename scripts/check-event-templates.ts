// Fails when an event text in any game locale still shows a raw template ({Var}, [Var]) or a missing-var "X".
// A new event whose vars are rolled at runtime needs an eventDisplayVars entry in src/lib/codex-data.ts.
// Run: pnpm -s tsx scripts/check-event-templates.ts
import { getCodexEvents } from "../src/lib/codex-data";
import { GAME_LOCALES } from "../src/lib/i18n";

// Filled in the client: character quotes (event-character-quotes.ts) and Tinker Time riders (tinker-time.ts).
const CLIENT_FILLED = new Set(["AromaPrinciple", "Monologue", "SappingWeak", "SappingVulnerable", "ChokingDamage", "ExpertiseStrength", "ExpertiseDexterity"]);
const RESIDUE_RE = /\{([A-Za-z]\w*)[^}]*\}|\[([A-Z][a-z]\w*)\]|\]X\[/g;

(async () => {
  const failures: string[] = [];
  for (const locale of GAME_LOCALES) {
    for (const event of await getCodexEvents({ gameLocale: locale })) {
      const texts: [string, string | null | undefined][] = [["description", event.description]];
      for (const option of event.options ?? []) texts.push([`option ${option.id}`, option.description], [`option ${option.id} title`, option.title]);
      for (const page of event.pages ?? []) {
        texts.push([`page ${page.id}`, page.description]);
        for (const option of page.options ?? []) texts.push([`page ${page.id} option ${option.id}`, option.description]);
      }
      for (const [where, text] of texts) {
        for (const m of (text ?? "").matchAll(RESIDUE_RE)) {
          if (!CLIENT_FILLED.has(m[1] ?? m[2] ?? "")) failures.push(`${locale} ${event.id} ${where}: ${m[0]}`);
        }
      }
    }
  }
  if (failures.length) {
    console.error(`${failures.length} unresolved event template(s):\n${[...new Set(failures)].join("\n")}`);
    process.exit(1);
  }
  console.log(`event templates ok (${GAME_LOCALES.length} locales)`);
})();
