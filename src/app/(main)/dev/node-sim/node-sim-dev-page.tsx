import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { BlitzMerchantData } from "@/lib/node-sim/blitz-merchant";
import { NODE_SIM_PRESETS, parseNodeSimQuery, type NodeSimQuery } from "@/lib/node-sim/scenarios";
import type { BlitzMerchantLayoutView, BlitzMerchantStageView } from "./blitz-merchant-stage";
import { NodeSimClient, type NodeSimView } from "./node-sim-client";

/** The Blitz merchant data and layout were extracted from this build (scripts/extract-blitz-merchant-assets.py). */
const DATA_VERSION = "0.113.0";
const ACTS = ["overgrowth", "hive", "glory", "underdocks"];
const FULL_ZOOM = 1920 / 1080;

type Manifest = BlitzMerchantData & {
  layout: BlitzMerchantLayoutView;
  spine: {
    merchant: BlitzMerchantStageView["spine"]["merchant"];
    hand: BlitzMerchantStageView["spine"]["hand"];
    characters: Record<string, NonNullable<BlitzMerchantStageView["spine"]["character"]>>;
  };
};

function one(query: NodeSimQuery, key: string) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NodeSimDevPage({ searchParams }: { searchParams: NodeSimQuery }) {
  const parsed = parseNodeSimQuery(searchParams);
  const errors = [...parsed.errors];
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "data/sts2/blitz-merchant.json"), "utf8")) as Manifest;
  const { input } = parsed;
  const warnings: string[] = [];
  if (input.version !== DATA_VERSION) warnings.push(`the Blitz merchant data is ${DATA_VERSION}'s; v${input.version} may differ`);
  if (!ACTS.includes(input.act)) errors.push(`act must be one of ${ACTS.join(", ")}`);
  const background = `/images/sts2/encounter-scenes/${ACTS.includes(input.act) ? input.act : "overgrowth"}-a.webp`;
  const character = manifest.spine.characters[input.character] ?? null;
  if (!character) errors.push(`character ${input.character} has no merchant pose (${Object.keys(manifest.spine.characters).join(", ")})`);

  const zoomRaw = one(searchParams, "zoom");
  const zoom = !zoomRaw || zoomRaw === "full" ? FULL_ZOOM : zoomRaw === "fit" ? 1080 / 1920 : Number(zoomRaw);
  if (!Number.isFinite(zoom) || zoom <= 0) errors.push(`zoom must be full, fit or a number, got ${zoomRaw}`);
  const cameraRaw = one(searchParams, "camera");
  const tRaw = one(searchParams, "t");
  const frame = Number(one(searchParams, "frame") ?? 360);
  const view: NodeSimView = {
    input,
    preset: parsed.preset,
    data: manifest,
    warnings,
    stage: {
      layout: manifest.layout,
      background: existsSync(path.join(process.cwd(), "public", background)) ? background : null,
      spine: { merchant: manifest.spine.merchant, hand: manifest.spine.hand, character },
      backButton: { image: "/images/sts2/ui/back_button.png", arrow: "/images/sts2/ui/back_button_arrow.png" },
      options: {
        zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : FULL_ZOOM,
        isolate: one(searchParams, "isolate") === "1",
        camera: cameraRaw !== undefined && Number.isFinite(Number(cameraRaw)) ? Number(cameraRaw) : null,
      },
    },
    options: {
      t: tRaw === undefined ? null : tRaw === "end" ? "end" : Number(tRaw),
      autoplay: one(searchParams, "autoplay") === "1",
      frame: Number.isFinite(frame) && frame > 0 ? frame : 360,
    },
  };

  return (
    <>
      <NodeSimClient view={view} errors={errors} />
      <nav className="flex flex-wrap gap-2 px-4 pb-8 text-xs">
        {Object.keys(NODE_SIM_PRESETS).map((name) => (
          <Link key={name} className="rounded border border-white/10 px-2 py-1 text-sky-300 hover:bg-white/10" href={`/dev/node-sim?preset=${name}`}>{name}</Link>
        ))}
      </nav>
    </>
  );
}
