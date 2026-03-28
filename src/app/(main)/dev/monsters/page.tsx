import fs from "fs/promises";
import path from "path";
import Image from "next/image";
import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "몬스터 도감 — DEV",
  description: "개발 전용: 전체 몬스터 데이터 및 에셋 미리보기",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Monster {
  id: string;
  name: string;
  type: "Normal" | "Elite" | "Boss" | string;
  min_hp: number | null;
  max_hp: number | null;
  min_hp_ascension: number | null;
  max_hp_ascension: number | null;
  moves: { id: string; name: string }[];
  damage_values: Record<string, { normal: number | null; ascension: number | null }> | null;
  block_values: Record<string, number> | null;
  image_url: string;
}

interface EncounterMonsterRef {
  id: string;
  name: string;
}

interface Encounter {
  id: string;
  name: string;
  room_type: "Monster" | "Elite" | "Boss" | string;
  is_weak: boolean;
  act: string | null;
  tags: string[] | null;
  monsters: EncounterMonsterRef[];
  loss_text: string;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data/spire-codex");

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DATA_DIR, relativePath), "utf-8"));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ORDER: Record<string, number> = { Normal: 0, Elite: 1, Boss: 2 };

function typeOrder(t: string): number {
  return TYPE_ORDER[t] ?? 3;
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  Normal: "bg-zinc-700 text-zinc-200",
  Elite: "bg-yellow-600/80 text-yellow-100",
  Boss: "bg-red-700/80 text-red-100",
};

function typeBadge(type: string) {
  const cls = TYPE_BADGE_CLASSES[type] ?? "bg-purple-700/80 text-purple-100";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none ${cls}`}>
      {type}
    </span>
  );
}

function hpLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return "?";
  if (min === max || max == null) return `${min}`;
  if (min == null) return `${max}`;
  return `${min}-${max}`;
}

/** Transform spire-codex image_url to local path, with boss fallback */
function resolveImageUrl(monster: Monster, bossImageNames: Set<string>): string {
  // Base path from image_url: "/static/images/monsters/X.png" -> "X.png"
  const filename = monster.image_url.split("/").pop() ?? "";
  const baseName = filename.replace(".png", "");

  // For boss type, check if a boss-specific image exists
  if (monster.type === "Boss") {
    const bossFilename = `${baseName}_boss.png`;
    if (bossImageNames.has(bossFilename)) {
      return `/images/spire-codex/bosses/${bossFilename}`;
    }
  }

  return `/images/spire-codex/monsters/${filename}`;
}

const ROOM_BADGE: Record<string, string> = {
  Monster: "bg-zinc-700 text-zinc-200",
  Elite: "bg-yellow-600/80 text-yellow-100",
  Boss: "bg-red-700/80 text-red-100",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MonstersDevPage() {
  const [monsters, encounters] = await Promise.all([
    readJson<Monster[]>("eng/monsters.json"),
    readJson<Encounter[]>("eng/encounters.json"),
  ]);

  // Read boss image directory for fallback lookup
  const bossDir = path.join(process.cwd(), "public/images/spire-codex/bosses");
  const bossFiles = await fs.readdir(bossDir).catch(() => [] as string[]);
  const bossImageNames = new Set(bossFiles);

  // Read render images
  const rendersDir = path.join(process.cwd(), "public/images/spire-codex/renders");
  const renderFiles = (await fs.readdir(rendersDir).catch(() => [] as string[]))
    .filter((f) => f.endsWith(".png"))
    .sort();
  const renderNamesSet = new Set(renderFiles.map((f) => f.toLowerCase()));

  // Read beta monster images
  const betaDir = path.join(process.cwd(), "public/images/spire-codex/monsters-beta");
  const betaFiles = (await fs.readdir(betaDir).catch(() => [] as string[]))
    .filter((f) => f.endsWith(".png"))
    .sort();

  // Sort monsters by type, then name
  const sorted = [...monsters].sort((a, b) => {
    const td = typeOrder(a.type) - typeOrder(b.type);
    if (td !== 0) return td;
    return a.name.localeCompare(b.name);
  });

  // Group by type
  const grouped = new Map<string, Monster[]>();
  for (const m of sorted) {
    const list = grouped.get(m.type) ?? [];
    list.push(m);
    grouped.set(m.type, list);
  }

  // Stats
  const total = monsters.length;
  const typeCounts = Object.fromEntries([...grouped.entries()].map(([k, v]) => [k, v.length]));

  // Sort encounters by room_type then act
  const sortedEncounters = [...encounters].sort((a, b) => {
    const roomOrder: Record<string, number> = { Monster: 0, Elite: 1, Boss: 2 };
    const rd = (roomOrder[a.room_type] ?? 3) - (roomOrder[b.room_type] ?? 3);
    if (rd !== 0) return rd;
    return (a.act ?? "").localeCompare(b.act ?? "");
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* DEV ONLY banner */}
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          개발 환경 전용 레퍼런스 — 프로덕션 빌드에서 숨김 처리 필요
        </span>
      </div>

      <h1 className="text-2xl font-bold">몬스터 도감</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        DEV — 전체 몬스터 데이터 및 에셋 미리보기
      </p>

      {/* Stats summary */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-yellow-500 mb-3">통계 요약</h2>
        <div className="flex flex-wrap gap-3">
          <div className="rounded border border-border bg-card/50 px-4 py-3">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">전체 몬스터</div>
          </div>
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} className="rounded border border-border bg-card/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{count}</div>
                {typeBadge(type)}
              </div>
              <div className="text-xs text-muted-foreground">{type}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Renders section */}
      <section id="renders-section" className="mt-10">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">
          렌더 (Spine Renders) — {renderFiles.length}장
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          몬스터/캐릭터/보스의 풀바디 스파인 렌더 이미지
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {renderFiles.map((file) => {
            const label = file.replace(".png", "");
            return (
              <div
                key={file}
                id={`render-${label}`}
                className="rounded border border-border bg-card/50 p-2 flex flex-col items-center"
              >
                <div className="relative w-[200px] h-[200px] mb-2">
                  <Image
                    src={`/images/spire-codex/renders/${file}`}
                    alt={label}
                    fill
                    unoptimized
                    className="object-contain"
                    sizes="200px"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground text-center truncate w-full" title={label}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Beta monster art section */}
      {betaFiles.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-yellow-500 mb-4">
            베타 몬스터 아트 — {betaFiles.length}장
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            개발 중 사용된 베타 버전 몬스터 이미지
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {betaFiles.map((file) => {
              const label = file.replace(".png", "");
              return (
                <div
                  key={file}
                  className="rounded border border-border bg-card/50 p-2 flex flex-col items-center"
                >
                  <div className="relative w-[120px] h-[120px] mb-2">
                    <Image
                      src={`/images/spire-codex/monsters-beta/${file}`}
                      alt={label}
                      fill
                      unoptimized
                      className="object-contain"
                      sizes="120px"
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground text-center truncate w-full" title={label}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Monster gallery by type */}
      {[...grouped.entries()].map(([type, typeMonsters]) => (
        <section key={type} className="mt-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {typeBadge(type)}
            <span>{type} 몬스터 ({typeMonsters.length})</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {typeMonsters.map((m) => {
              const imgSrc = resolveImageUrl(m, bossImageNames);
              // Check if a matching render exists (monster filename without extension, lowercased)
              const monsterFilename = (m.image_url.split("/").pop() ?? "").toLowerCase();
              const monsterBaseName = monsterFilename.replace(".png", "");
              const hasRender = renderNamesSet.has(monsterFilename);
              return (
                <div
                  key={m.id}
                  className="rounded border border-border bg-card/50 p-2 flex flex-col items-center hover:border-yellow-500/40 transition-colors"
                >
                  <div className="relative w-[120px] h-[120px] mb-2">
                    <Image
                      src={imgSrc}
                      alt={m.name}
                      fill
                      unoptimized
                      className="object-contain"
                      sizes="120px"
                    />
                  </div>
                  <div className="text-center w-full">
                    <div className="text-xs font-semibold leading-tight truncate flex items-center justify-center gap-1" title={m.name}>
                      {m.name}
                      {hasRender && (
                        <a
                          href={`#render-${monsterBaseName}`}
                          className="inline-block rounded bg-emerald-700/80 px-1 py-0.5 text-[9px] font-bold text-emerald-100 leading-none hover:bg-emerald-600/80 transition-colors"
                        >
                          렌더
                        </a>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      HP {hpLabel(m.min_hp, m.max_hp)}
                      {m.min_hp_ascension != null && (
                        <span className="text-yellow-500/70 ml-1">
                          (A: {hpLabel(m.min_hp_ascension, m.max_hp_ascension)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Monster detail cards */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">몬스터 상세 정보</h2>
        <div className="space-y-4">
          {sorted.map((m) => (
            <div
              key={m.id}
              id={`detail-${m.id}`}
              className="rounded border border-border bg-card/50 p-4"
            >
              <div className="flex items-start gap-4">
                <div className="relative w-[80px] h-[80px] shrink-0">
                  <Image
                    src={resolveImageUrl(m, bossImageNames)}
                    alt={m.name}
                    fill
                    unoptimized
                    className="object-contain"
                    sizes="80px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{m.name}</span>
                    {typeBadge(m.type)}
                    <span className="text-xs text-muted-foreground font-mono">{m.id}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    HP: {hpLabel(m.min_hp, m.max_hp)}
                    {m.min_hp_ascension != null && (
                      <span className="ml-2 text-yellow-500/70">
                        Ascension HP: {hpLabel(m.min_hp_ascension, m.max_hp_ascension)}
                      </span>
                    )}
                  </div>

                  {/* Moves */}
                  {m.moves.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">행동 (Moves)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.moves.map((mv) => (
                          <span
                            key={mv.id}
                            className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300"
                          >
                            {mv.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Damage values */}
                  {m.damage_values && Object.keys(m.damage_values).length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">피해량 (Damage)</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(m.damage_values).map(([moveName, dmg]) => (
                          <span key={moveName} className="text-[11px]">
                            <span className="text-muted-foreground">{moveName}:</span>{" "}
                            <span className="text-red-400">{dmg.normal ?? "?"}</span>
                            {dmg.ascension != null && (
                              <span className="text-yellow-500/70 ml-0.5">
                                (A: {dmg.ascension})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Block values */}
                  {m.block_values && Object.keys(m.block_values).length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">방어도 (Block)</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(m.block_values).map(([key, val]) => (
                          <span key={key} className="text-[11px]">
                            <span className="text-muted-foreground">{key}:</span>{" "}
                            <span className="text-blue-400">{val}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Encounters section */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">전투 조합 (Encounters)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          전체 {encounters.length}개 전투 조합. 어떤 몬스터들이 함께 등장하는지 확인할 수 있습니다.
        </p>

        <div className="space-y-3">
          {sortedEncounters.map((enc) => {
            const roomCls = ROOM_BADGE[enc.room_type] ?? "bg-purple-700/80 text-purple-100";
            return (
              <div
                key={enc.id}
                className="rounded border border-border bg-card/50 p-3"
              >
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-sm">{enc.name}</span>
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none ${roomCls}`}>
                    {enc.room_type}
                  </span>
                  {enc.is_weak && (
                    <span className="inline-block rounded bg-zinc-600 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300 leading-none">
                      WEAK
                    </span>
                  )}
                  {enc.act && (
                    <span className="text-[10px] text-muted-foreground">{enc.act}</span>
                  )}
                  {enc.tags && enc.tags.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      [{enc.tags.join(", ")}]
                    </span>
                  )}
                </div>

                {/* Monster list */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {enc.monsters.map((mr) => (
                    <span
                      key={mr.id}
                      className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300"
                    >
                      {mr.name}
                    </span>
                  ))}
                </div>

                {/* Loss text */}
                {enc.loss_text && (
                  <div className="text-[11px] text-muted-foreground italic">
                    <RichText text={enc.loss_text} />
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground/50 mt-1 font-mono">{enc.id}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
