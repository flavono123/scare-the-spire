/**
 * Prints every link the STS1 related rails draw, grouped by why it exists.
 * `pnpm exec tsx scripts/report-sts1-relations.ts [source...]` limits the sources.
 */
import { getSts1RelationGraph, getSts1Related, STS1_RELATED_KINDS, type Sts1RelatedKind } from "../src/lib/sts1/relations";

async function main() {
  const only = new Set(process.argv.slice(2));
  const graph = await getSts1RelationGraph();
  const nameCache = new Map<string, string>();
  const nameOf = async (key: string) => {
    const [kind, ...rest] = key.split(":");
    const slug = rest.join(":");
    if (!nameCache.has(key)) {
      // Resolve through a neighbour's rail, which carries names.
      const neighbour = [...(graph.get(key as never)?.keys() ?? [])][0] as string | undefined;
      if (neighbour) {
        const [nKind, ...nRest] = neighbour.split(":");
        const groups = await getSts1Related(nKind as Sts1RelatedKind, nRest.join(":"));
        for (const group of groups) for (const item of group.items) nameCache.set(`${group.kind}:${item.slug}`, item.name);
      }
    }
    return `${nameCache.get(key) ?? slug} (${kind})`;
  };
  const bySource = new Map<string, string[]>();
  for (const [from, targets] of graph) {
    for (const [to, sources] of targets) {
      if (from > to) continue;
      for (const source of sources) {
        if (only.size && !only.has(source)) continue;
        const list = bySource.get(source) ?? [];
        list.push(`${await nameOf(from)} — ${await nameOf(to)}`);
        bySource.set(source, list);
      }
    }
  }
  for (const [source, lines] of bySource) {
    console.log(`\n## ${source} (${lines.length})`);
    for (const line of lines.sort()) console.log(`- ${line}`);
  }
  void STS1_RELATED_KINDS;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
