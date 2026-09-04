import type { HistoryRunFloorBlock, PostBlock } from "@/lib/chemical-types";
import { historyRunFloorTypeSpriteSrc, historyRunHistorySpriteSrc } from "@/lib/history-run-history-sprite";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import type { ReplayActAnalysis, ReplayHistoryEntry } from "@/lib/sts2-run-replay";

const MAP_POINT_TYPES = new Set([
  "ancient",
  "monster",
  "unknown",
  "elite",
  "rest_site",
  "treasure",
  "shop",
  "boss",
]);

export function historyFloorFromActStep(baseFloor: number, step: number): number {
  return baseFloor + step - 1;
}

export function isHistoryRunFloorBlock(value: unknown): value is HistoryRunFloorBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  if (block.type !== "history-run-floor") return false;
  if (typeof block.floor !== "number" || !Number.isFinite(block.floor) || block.floor < 1) {
    return false;
  }
  if (typeof block.actIndex !== "number" || !Number.isFinite(block.actIndex) || block.actIndex < 0) {
    return false;
  }
  if (typeof block.step !== "number" || !Number.isFinite(block.step) || block.step < 1) {
    return false;
  }
  if (typeof block.mapPointType !== "string" || !MAP_POINT_TYPES.has(block.mapPointType)) {
    return false;
  }
  if (block.spriteSrc != null && typeof block.spriteSrc !== "string") return false;
  return true;
}

export function historyRunFloorPlainText(
  block: HistoryRunFloorBlock,
  serviceLocale: ServiceLocale = "ko",
): string {
  return serviceMessages[serviceLocale].historyCourse.detail.playback.floorOnly.replace(
    "{floor}",
    String(block.floor),
  );
}

export function historyRunFloorSpriteSrc(block: HistoryRunFloorBlock): string {
  const stored = block.spriteSrc?.trim();
  if (stored) return stored;
  return historyRunFloorTypeSpriteSrc(block.mapPointType);
}

export function buildHistoryRunFloorBlock(
  act: Pick<ReplayActAnalysis, "actIndex" | "baseFloor" | "history">,
  step: number,
  entry?: ReplayHistoryEntry | null,
): HistoryRunFloorBlock | null {
  const historyEntry = entry ?? act.history[step - 1] ?? null;
  if (!historyEntry) return null;
  const mapPointType = MAP_POINT_TYPES.has(historyEntry.map_point_type)
    ? historyEntry.map_point_type
    : "unknown";
  return {
    type: "history-run-floor",
    floor: historyFloorFromActStep(act.baseFloor, step),
    actIndex: act.actIndex,
    step,
    mapPointType,
    spriteSrc: historyRunHistorySpriteSrc(historyEntry),
  };
}

export function historyRunFloorsFromBlocks(
  blocks: PostBlock[] | null | undefined,
): HistoryRunFloorBlock[] {
  if (!blocks?.length) return [];
  return blocks.filter(isHistoryRunFloorBlock);
}

export function commentMentionsHistoryFloor(
  blocks: PostBlock[] | null | undefined,
  actIndex: number,
  step: number,
): boolean {
  return historyRunFloorsFromBlocks(blocks).some(
    (block) => block.actIndex === actIndex && block.step === step,
  );
}

export function historyFloorCatalogFromActs(
  acts: Array<Pick<ReplayActAnalysis, "baseFloor" | "history">>,
): HistoryRunFloorBlock[] {
  const catalog: HistoryRunFloorBlock[] = [];
  for (let actIndex = 0; actIndex < acts.length; actIndex += 1) {
    const act = acts[actIndex];
    for (let step = 1; step <= act.history.length; step += 1) {
      const block = buildHistoryRunFloorBlock({ ...act, actIndex }, step);
      if (block) catalog.push(block);
    }
  }
  return catalog;
}

export function matchHistoryFloorMentions(
  query: string,
  catalog: HistoryRunFloorBlock[],
  currentFloor?: number,
): HistoryRunFloorBlock[] {
  const digits = query.replace(/\D/g, "");
  const filtered = digits
    ? catalog.filter((block) => String(block.floor).startsWith(digits))
    : catalog;
  return [...filtered]
    .sort((left, right) => {
      if (currentFloor != null) {
        const leftDistance = Math.abs(left.floor - currentFloor);
        const rightDistance = Math.abs(right.floor - currentFloor);
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      }
      return left.floor - right.floor;
    })
    .slice(0, 12);
}

const HASH_FLOOR_RE = /#(\d+)/g;

export function materializeHistoryFloorMentions(
  blocks: PostBlock[],
  catalog: HistoryRunFloorBlock[],
): PostBlock[] {
  if (!catalog.length) return blocks;
  const byFloor = new Map(catalog.map((block) => [block.floor, block]));
  const next: PostBlock[] = [];
  for (const block of blocks) {
    if (block.type !== "text") {
      next.push(block);
      continue;
    }
    HASH_FLOOR_RE.lastIndex = 0;
    let cursor = 0;
    let matched = false;
    let match: RegExpExecArray | null = HASH_FLOOR_RE.exec(block.text);
    while (match) {
      const floor = Number(match[1]);
      const hit = Number.isFinite(floor) ? byFloor.get(floor) : undefined;
      if (!hit) {
        match = HASH_FLOOR_RE.exec(block.text);
        continue;
      }
      matched = true;
      if (match.index > cursor) {
        next.push({ type: "text", text: block.text.slice(cursor, match.index) });
      }
      next.push(hit);
      cursor = match.index + match[0].length;
      match = HASH_FLOOR_RE.exec(block.text);
    }
    if (!matched) {
      next.push(block);
      continue;
    }
    if (cursor < block.text.length) {
      next.push({ type: "text", text: block.text.slice(cursor) });
    }
  }
  return next;
}

export type HistoryMapCommentMark = {
  step: number;
  count: number;
  current: boolean;
};

export function historyMapCommentMarksForAct(
  comments: Array<{ content_blocks?: PostBlock[] | null }>,
  actIndex: number,
  currentStep: number,
): HistoryMapCommentMark[] {
  const counts = new Map<number, number>();
  for (const comment of comments) {
    const seen = new Set<number>();
    for (const block of historyRunFloorsFromBlocks(comment.content_blocks)) {
      if (block.actIndex !== actIndex) continue;
      if (seen.has(block.step)) continue;
      seen.add(block.step);
      counts.set(block.step, (counts.get(block.step) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([step, count]) => ({
      step,
      count,
      current: step === currentStep,
    }));
}
