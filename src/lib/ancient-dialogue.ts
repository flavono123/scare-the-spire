import type { AncientDialogueLine, AncientDialogueScene } from "./codex-types";

export type AncientDialogueOrder = {
  raw: string;
  variant: number;
  line: number;
  suffix: "r" | null;
};

export function parseAncientDialogueOrder(raw: string): AncientDialogueOrder {
  const match = /^(\d+)-(\d+)(r?)$/.exec(raw);
  if (!match) throw new Error(`Invalid Ancient dialogue order: ${raw}`);
  return {
    raw,
    variant: Number(match[1]),
    line: Number(match[2]),
    suffix: match[3] === "r" ? "r" : null,
  };
}

export function groupAncientDialogueLines(lines: AncientDialogueLine[]): AncientDialogueScene[] {
  const scenes = new Map<string, AncientDialogueScene>();
  for (const line of lines) {
    const order = parseAncientDialogueOrder(line.order);
    const id = `${order.variant}${order.suffix ?? ""}`;
    const scene = scenes.get(id) ?? {
      id,
      variant: order.variant,
      suffix: order.suffix,
      lines: [],
    };
    scene.lines.push(line);
    scenes.set(id, scene);
  }
  return [...scenes.values()]
    .sort((left, right) => left.variant - right.variant || Number(Boolean(left.suffix)) - Number(Boolean(right.suffix)))
    .map((scene) => ({
      ...scene,
      lines: scene.lines.toSorted((left, right) => (
        parseAncientDialogueOrder(left.order).line - parseAncientDialogueOrder(right.order).line
      )),
    }));
}
