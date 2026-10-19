import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { getCodexCharacters, getCodexPowers } from "@/lib/codex-data";
import { loadCombatSimCatalog } from "@/lib/combat-sim/catalog";
import { parsePowerSpec, sceneParts } from "@/lib/combat-sim/engine";
import { COMBAT_SIM_PRESETS } from "@/lib/combat-sim/scenarios";
import { resolveMonsterStaticArt } from "@/lib/monster-static-art";
import { CombatSimClient } from "./combat-sim-client";
import { parseCombatSimQuery, type SearchParams } from "./query-input";
import type { CombatSimMonsterView, CombatSimView, EnergyCounterAsset } from "./view-types";
import type { CardTrailAsset, EnergyGainVfx } from "./vfx-layer";

interface CombatUiAssets {
  energyCounters: Record<string, EnergyCounterAsset>;
  energyGainVfx: Record<string, EnergyGainVfx>;
  cardTrails: Record<string, CardTrailAsset | null>;
  powerIcons: Record<string, string>;
  ui: Record<string, string>;
}

async function readCombatUiAssets(): Promise<CombatUiAssets> {
  const file = path.join(process.cwd(), "data/sts2/combat-ui-assets.json");
  return JSON.parse(await readFile(file, "utf8")) as CombatUiAssets;
}

export default async function CombatSimDevPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseCombatSimQuery(searchParams);
  if (!query.input) return <CombatSimUsage errors={query.errors} />;

  let view: CombatSimView;
  try {
    view = await buildView(query.input, query);
  } catch (error) {
    return <CombatSimUsage errors={[...query.errors, error instanceof Error ? error.message : String(error)]} />;
  }
  return <CombatSimClient view={view} errors={query.errors} />;
}

async function buildView(
  input: NonNullable<ReturnType<typeof parseCombatSimQuery>["input"]>,
  query: ReturnType<typeof parseCombatSimQuery>,
): Promise<CombatSimView> {
  // Character art and card interface assets load only for the parts that show them.
  const parts = sceneParts(input);
  const withPlayer = parts.includes("player");
  const withCards = parts.includes("cards");
  const [{ catalog, warnings, entities }, characters, sitePowers, uiAssets] = await Promise.all([
    loadCombatSimCatalog(input),
    withPlayer ? getCodexCharacters({ gameLocale: "kor" }) : Promise.resolve([]),
    getCodexPowers({ gameLocale: "kor", includeDeprecated: true }),
    readCombatUiAssets(),
  ]);
  const characterId = catalog.character?.id ?? null;
  const character = withPlayer && characterId ? characters.find((entry) => entry.id === characterId) ?? null : null;
  const scene = entities.encounter?.scene ?? null;
  const layoutById = new Map((scene?.combatLayout.monsters ?? []).map((layout) => [layout.monsterId, layout]));
  const slotByName = new Map((scene?.monsterSlots ?? []).map((slot) => [slot.slotName, slot]));

  const monsters: CombatSimMonsterView[] = catalog.encounter.monsters.map(({ monsterId, slot }) => {
    const monster = entities.monsters[monsterId];
    const staticArt = resolveMonsterStaticArt(monsterId, catalog.version);
    const slotPosition = slot ? slotByName.get(slot)?.sourcePosition ?? null : null;
    return {
      id: monsterId,
      name: monster?.name ?? monsterId,
      spine: staticArt ? null : monster?.spineAsset ?? null,
      staticArt,
      imageUrl: monster?.imageUrl ?? monster?.bossImageUrl ?? null,
      layout: layoutById.get(monsterId) ?? null,
      slotPosition,
    };
  });

  const powerIds = new Set(Object.values(input.powers ?? {}).flat().map((spec) => parsePowerSpec(spec).id));
  const powerIcons: Record<string, string | null> = {};
  for (const powerId of powerIds) {
    powerIcons[powerId] = sitePowers.find((power) => power.id === powerId)?.imageUrl ?? uiAssets.powerIcons[powerId] ?? null;
  }

  return {
    input,
    preset: query.preset,
    catalog,
    warnings,
    options: query.options,
    cards: entities.cards,
    background: scene?.backgroundUrl ?? null,
    combatLayout: scene?.combatLayout ?? null,
    monsterSlots: scene?.monsterSlots ?? [],
    parts,
    character: catalog.character && characterId
      ? {
        id: characterId,
        name: catalog.character.name,
        spine: character?.spineAsset ?? null,
        imageUrl: character?.combatImageUrl ?? null,
        energyCounter: withCards ? uiAssets.energyCounters[characterId] ?? null : null,
      }
      : null,
    monsters,
    powerIcons,
    ui: uiAssets.ui,
    cardTrail: withCards && characterId ? uiAssets.cardTrails[characterId] ?? null : null,
    energyGainVfx: withCards && characterId ? uiAssets.energyGainVfx[characterId] ?? null : null,
  };
}

function CombatSimUsage({ errors }: { errors: string[] }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">DEV / COMBAT SIM</p>
        <h1 className="text-2xl font-bold text-zinc-100">전투 시뮬레이터</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          입력은 URL 쿼리 또는 <code>json=</code> 하나입니다. 스키마와 지원 범위는 <code>docs/COMBAT_SIM.md</code>에 있습니다.
        </p>
      </header>
      {errors.length > 0 && (
        <ul className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">프리셋</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {Object.keys(COMBAT_SIM_PRESETS).map((name) => (
            <li key={name}>
              <Link className="text-sky-300 hover:underline" href={`/dev/combat-sim?preset=${name}`}>{name}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2 text-sm text-zinc-400">
        <h2 className="text-sm font-semibold text-zinc-200">쿼리 예</h2>
        <code className="break-all rounded bg-white/5 px-3 py-2 text-xs text-zinc-300">
          /dev/combat-sim?version=0.102.0&amp;character=SILENT&amp;encounter=DOORMAKER_BOSS&amp;energy=3/3&amp;hand=ACROBATICS,PREPARED+&amp;draw=STRIKE_SILENT*6&amp;powers=DOORMAKER=GRASP_POWER:1&amp;moves=DOORMAKER=GRASP&amp;script=wait:600,play:ACROBATICS,play:PREPARED+,wait:800
        </code>
      </section>
    </main>
  );
}
