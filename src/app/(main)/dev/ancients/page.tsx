import fs from "fs/promises";
import path from "path";
import Image from "next/image";
import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "고대신 — DEV",
  description: "DEV — 에포크 타임라인, 고대 존재/보스/NPC/렌더 에셋 미리보기",
};

interface Epoch {
  id: string;
  title: string;
  description: string;
  era: string;
  era_name: string | null;
  era_year: string | null;
  era_position: number;
  sort_order: number;
  story_id: string | null;
  unlock_info: string;
  unlock_text: string | null;
  unlocks_cards: string[];
  unlocks_relics: string[];
  unlocks_potions: string[];
  expands_timeline: string[];
}

const STORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Magnum_Opus: { bg: "bg-yellow-900/30", text: "text-yellow-400", border: "border-yellow-600" },
  Silent: { bg: "bg-green-900/30", text: "text-green-400", border: "border-green-600" },
  Ironclad: { bg: "bg-red-900/30", text: "text-red-400", border: "border-red-600" },
  Defect: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-600" },
  Necrobinder: { bg: "bg-purple-900/30", text: "text-purple-400", border: "border-purple-600" },
  Regent: { bg: "bg-orange-900/30", text: "text-orange-400", border: "border-orange-600" },
  Reopening: { bg: "bg-slate-800/30", text: "text-slate-300", border: "border-slate-500" },
  Tales_From_The_Spire: { bg: "bg-cyan-900/30", text: "text-cyan-400", border: "border-cyan-600" },
};

const STORY_LABELS: Record<string, string> = {
  Magnum_Opus: "마그눔 오푸스",
  Silent: "사일런트",
  Ironclad: "아이언클래드",
  Defect: "디펙트",
  Necrobinder: "네크로바인더",
  Regent: "리젠트",
  Reopening: "다시 열리다",
  Tales_From_The_Spire: "첨탑의 이야기들",
};

function formatImageName(filename: string): string {
  return filename
    .replace(/\.(png|webp)$/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function AncientsDevPage() {
  // Read epoch data
  const epochsPath = path.join(process.cwd(), "data/spire-codex/kor/epochs.json");
  const epochsRaw = await fs.readFile(epochsPath, "utf-8");
  const epochs: Epoch[] = JSON.parse(epochsRaw);
  epochs.sort((a, b) => a.sort_order - b.sort_order);

  // Read image directories
  const ancientsDir = path.join(process.cwd(), "public/images/spire-codex/ancients");
  const bossesDir = path.join(process.cwd(), "public/images/spire-codex/bosses");
  const npcsDir = path.join(process.cwd(), "public/images/spire-codex/npcs");
  const ancientNodesDir = path.join(process.cwd(), "public/images/spire-codex/ancient-nodes");

  const ancientsBgDir = path.join(process.cwd(), "public/images/spire-codex/ancients-bg");

  // Safe readdir that returns [] for missing directories
  const safeReaddir = async (dir: string) => {
    try { return await fs.readdir(dir); } catch { return []; }
  };
  const imgExt = /\.(png|webp)$/;

  const ancientFiles = (await safeReaddir(ancientsDir)).filter((f) => imgExt.test(f)).sort();
  const ancientBgFiles = (await safeReaddir(ancientsBgDir)).filter((f) => imgExt.test(f)).sort();
  const bossFiles = (await safeReaddir(bossesDir)).filter((f) => imgExt.test(f)).sort();
  const npcFiles = (await safeReaddir(npcsDir)).filter((f) => imgExt.test(f)).sort();
  const renderFiles: string[] = []; // renders directory removed
  const epochImageFiles = new Set<string>(); // epochs directory removed
  const ancientNodeFiles = (await safeReaddir(ancientNodesDir)).filter((f) => imgExt.test(f)).sort();
  const allEpochFiles: string[] = []; // epochs directory removed

  // Group epochs by era_name (use era as fallback key)
  const eraGroups: { name: string | null; year: string | null; epochs: Epoch[] }[] = [];
  let currentGroup: (typeof eraGroups)[number] | null = null;

  for (const epoch of epochs) {
    if (epoch.era_name) {
      // Start a new named era group
      currentGroup = { name: epoch.era_name, year: epoch.era_year, epochs: [epoch] };
      eraGroups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.epochs.push(epoch);
    } else {
      currentGroup = { name: null, year: null, epochs: [epoch] };
      eraGroups.push(currentGroup);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* DEV Banner */}
      <div className="mb-8 rounded-lg border border-yellow-600/50 bg-yellow-900/20 px-4 py-3 text-center">
        <span className="font-mono text-sm font-bold tracking-wider text-yellow-400">
          DEV ONLY
        </span>
        <span className="ml-2 text-sm text-yellow-400/70">
          — 이 페이지는 개발 참고용입니다
        </span>
      </div>

      {/* Page Header */}
      <header className="mb-12 text-center">
        <h1 className="mb-2 text-4xl font-bold text-amber-400">고대신</h1>
        <p className="text-lg text-zinc-400">
          DEV — 에포크 타임라인, 고대 존재/보스/NPC/렌더 에셋 미리보기
        </p>
      </header>

      {/* Ancient Beings Gallery */}
      <section className="mb-16">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-amber-400">고대 존재 (Ancients)</h2>
          <span className="text-sm text-zinc-500">{ancientFiles.length}장</span>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {ancientFiles.map((file) => (
            <div
              key={file}
              className="flex flex-col items-center gap-3 rounded-xl border border-amber-800/40 bg-zinc-900/60 p-4"
            >
              <div className="relative h-[150px] w-[150px] overflow-hidden rounded-lg">
                <Image
                  src={`/images/spire-codex/ancients/${file}`}
                  alt={formatImageName(file)}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="150px"
                />
              </div>
              <span className="text-sm font-semibold text-amber-300">
                {formatImageName(file)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Ancient Background Images Gallery */}
      <section className="mb-16">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-amber-400">고대 존재 배경 (Ancient Backgrounds)</h2>
          <span className="text-sm text-zinc-500">{ancientBgFiles.length}장</span>
        </div>
        <p className="mb-6 text-sm text-zinc-500">
          고대 존재 인카운터 시 표시되는 대형 배경 이미지 (2560×1200)
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {ancientBgFiles.map((file) => (
            <div
              key={file}
              className="flex flex-col items-center gap-3 rounded-xl border border-amber-800/40 bg-zinc-900/60 p-4"
            >
              <div className="relative aspect-[2560/1200] w-full overflow-hidden rounded-lg">
                <Image
                  src={`/images/spire-codex/ancients-bg/${file}`}
                  alt={formatImageName(file)}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <span className="text-sm font-semibold text-amber-300">
                {formatImageName(file)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Ancient Map Nodes Gallery */}
      <section className="mb-16">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-amber-400">고대신 맵 노드 (Ancient Nodes)</h2>
          <span className="text-sm text-zinc-500">{ancientNodeFiles.length}장</span>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {ancientNodeFiles.map((file) => (
            <div
              key={file}
              className="flex flex-col items-center gap-3 rounded-xl border border-amber-800/40 bg-zinc-900/60 p-4"
            >
              <div className="relative h-[120px] w-[120px] overflow-hidden rounded-lg">
                <Image
                  src={`/images/spire-codex/ancient-nodes/${file}`}
                  alt={formatImageName(file)}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="120px"
                />
              </div>
              <span className="text-sm font-semibold text-amber-300">
                {formatImageName(file)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Bosses Gallery */}
      <section className="mb-16">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-red-400">보스 (Bosses)</h2>
          <span className="text-sm text-zinc-500">{bossFiles.length}장</span>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {bossFiles.map((file) => (
            <div
              key={file}
              className="flex flex-col items-center gap-3 rounded-xl border border-red-800/40 bg-zinc-900/60 p-4"
            >
              <div className="relative h-[150px] w-[150px] overflow-hidden rounded-lg">
                <Image
                  src={`/images/spire-codex/bosses/${file}`}
                  alt={formatImageName(file)}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="150px"
                />
              </div>
              <span className="text-sm font-semibold text-red-300">
                {formatImageName(file)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* NPCs Gallery */}
      <section className="mb-16">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-cyan-400">NPC</h2>
          <span className="text-sm text-zinc-500">{npcFiles.length}장</span>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {npcFiles.map((file) => (
            <div
              key={file}
              className="flex flex-col items-center gap-3 rounded-xl border border-cyan-800/40 bg-zinc-900/60 p-4"
            >
              <div className="relative h-[150px] w-[150px] overflow-hidden rounded-lg">
                <Image
                  src={`/images/spire-codex/npcs/${file}`}
                  alt={formatImageName(file)}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="150px"
                />
              </div>
              <span className="text-sm font-semibold text-cyan-300">
                {formatImageName(file)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <hr className="mb-16 border-zinc-700/50" />

      {/* Spine Renders Gallery */}
      <section className="mb-16">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-emerald-400">렌더 (Spine Renders)</h2>
          <span className="text-sm text-zinc-500">{renderFiles.length}장</span>
        </div>
        <p className="mb-6 text-sm text-zinc-500">
          몬스터, 캐릭터, 고대 존재 등의 풀바디 Spine 렌더 이미지
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {renderFiles.map((file) => (
            <div
              key={file}
              className="flex flex-col items-center gap-2 rounded-xl border border-emerald-800/30 bg-zinc-900/60 p-3"
            >
              <div className="relative h-[200px] w-[200px] overflow-hidden rounded-lg">
                <Image
                  src={`/images/spire-codex/renders/${file}`}
                  alt={formatImageName(file)}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="200px"
                />
              </div>
              <span className="text-center text-xs font-medium text-emerald-300/80">
                {formatImageName(file)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Divider before epoch portrait gallery */}
      <hr className="mb-16 border-zinc-700/50" />

      {/* Epoch Portrait Gallery */}
      <section className="mb-16">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-violet-400">에포크 초상화 갤러리</h2>
          <span className="text-sm text-zinc-500">{allEpochFiles.length}장</span>
        </div>
        <p className="mb-6 text-sm text-zinc-500">
          타임라인에 등장하는 에포크별 초상화 일러스트
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {allEpochFiles.map((file) => (
            <div
              key={file}
              className="flex flex-col items-center gap-2 rounded-xl border border-violet-800/30 bg-zinc-900/60 p-3"
            >
              <div className="relative h-[200px] w-[200px] overflow-hidden rounded-lg">
                <Image
                  src={`/images/spire-codex/epochs/${file}`}
                  alt={formatImageName(file)}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="200px"
                />
              </div>
              <span className="text-center text-xs font-medium text-violet-300/80">
                {formatImageName(file)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Divider before timeline */}
      <hr className="mb-16 border-zinc-700/50" />

      {/* Epoch Timeline */}
      <section>
        <h2 className="mb-8 text-2xl font-bold text-amber-400">에포크 타임라인</h2>
        <p className="mb-8 text-zinc-400">
          총 {epochs.length}개 에포크 — sort_order 순서로 표시
        </p>

        <div className="relative border-l-2 border-amber-800/50 pl-8">
          {eraGroups.map((group, gi) => (
            <div key={gi} className="mb-12">
              {/* Era Header */}
              {group.name && (
                <div className="relative -ml-8 mb-6 pl-8">
                  {/* Timeline dot for era */}
                  <div className="absolute -left-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-amber-500 bg-amber-900" />
                  <div className="inline-flex items-baseline gap-3 rounded-lg border border-amber-700/50 bg-amber-950/40 px-5 py-3">
                    <h3 className="text-xl font-bold text-amber-300">{group.name}</h3>
                    {group.year && (
                      <span className="font-mono text-sm text-amber-500/70">
                        연도 {group.year}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Epochs in this group */}
              {group.epochs.map((epoch) => {
                const story = epoch.story_id
                  ? STORY_COLORS[epoch.story_id] ?? STORY_COLORS.Reopening
                  : null;
                const storyLabel = epoch.story_id
                  ? STORY_LABELS[epoch.story_id] ?? epoch.story_id
                  : null;

                const hasUnlocks =
                  epoch.unlocks_cards.length > 0 ||
                  epoch.unlocks_relics.length > 0 ||
                  epoch.unlocks_potions.length > 0;

                const epochImgKey = epoch.id.toLowerCase();
                const hasEpochImage = epochImageFiles.has(epochImgKey);

                return (
                  <div key={epoch.id} className="relative mb-8">
                    {/* Timeline dot */}
                    <div className="absolute -left-[41px] top-2 h-3 w-3 rounded-full border-2 border-zinc-500 bg-zinc-800" />

                    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-6">
                      {/* Epoch card: portrait + content */}
                      <div className={hasEpochImage ? "flex gap-6" : ""}>
                        {/* Epoch portrait */}
                        {hasEpochImage && (
                          <div className="flex-shrink-0">
                            <div className="relative h-[200px] w-[200px] overflow-hidden rounded-lg border border-zinc-700/50">
                              <Image
                                src={`/images/spire-codex/epochs/${epochImgKey}.png`}
                                alt={epoch.title}
                                fill
                                unoptimized
                                className="object-cover"
                                sizes="200px"
                              />
                            </div>
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {/* Header: Title + Story Badge */}
                          <div className="mb-3 flex flex-wrap items-center gap-3">
                            <h4 className="text-xl font-bold text-zinc-100">{epoch.title}</h4>
                            {story && storyLabel && (
                              <span
                                className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${story.bg} ${story.text} ${story.border}`}
                              >
                                {storyLabel}
                              </span>
                            )}
                            <span className="font-mono text-xs text-zinc-600">
                              {epoch.id}
                            </span>
                          </div>

                          {/* Description — the star of the show */}
                          <div className="mb-4 text-lg leading-relaxed text-zinc-300">
                            <RichText text={epoch.description} />
                          </div>

                          {/* Unlock Info */}
                          {epoch.unlock_info && (
                            <div className="mb-3 rounded-lg border border-zinc-700/40 bg-zinc-800/50 px-4 py-2">
                              <span className="mr-2 text-xs font-semibold tracking-wider text-zinc-500">
                                해금
                              </span>
                              <span className="text-sm text-zinc-400">
                                <RichText text={epoch.unlock_info} />
                              </span>
                            </div>
                          )}

                          {/* Unlock Text */}
                          {epoch.unlock_text && (
                            <div className="mb-3 rounded-lg border border-amber-800/30 bg-amber-950/20 px-4 py-2">
                              <span className="mr-2 text-xs font-semibold tracking-wider text-amber-600">
                                보상
                              </span>
                              <span className="text-sm text-amber-300/80">
                                <RichText text={epoch.unlock_text} />
                              </span>
                            </div>
                          )}

                          {/* Unlocked Items */}
                          {hasUnlocks && (
                            <div className="mt-3 flex flex-wrap gap-4 text-sm">
                              {epoch.unlocks_cards.length > 0 && (
                                <div>
                                  <span className="mr-1 text-xs font-semibold text-zinc-500">
                                    카드:
                                  </span>
                                  {epoch.unlocks_cards.map((c) => (
                                    <span
                                      key={c}
                                      className="mr-1 inline-block rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400"
                                    >
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {epoch.unlocks_relics.length > 0 && (
                                <div>
                                  <span className="mr-1 text-xs font-semibold text-zinc-500">
                                    유물:
                                  </span>
                                  {epoch.unlocks_relics.map((r) => (
                                    <span
                                      key={r}
                                      className="mr-1 inline-block rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {epoch.unlocks_potions.length > 0 && (
                                <div>
                                  <span className="mr-1 text-xs font-semibold text-zinc-500">
                                    포션:
                                  </span>
                                  {epoch.unlocks_potions.map((p) => (
                                    <span
                                      key={p}
                                      className="mr-1 inline-block rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400"
                                    >
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Expands Timeline */}
                          {epoch.expands_timeline.length > 0 && (
                            <div className="mt-3 text-sm">
                              <span className="mr-1 text-xs font-semibold text-zinc-500">
                                확장:
                              </span>
                              {epoch.expands_timeline.map((t) => (
                                <span
                                  key={t}
                                  className="mr-1 inline-block rounded bg-zinc-800/60 px-2 py-0.5 font-mono text-xs text-zinc-500"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Meta */}
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-600">
                            <span>sort: {epoch.sort_order.toLocaleString()}</span>
                            <span>era: {epoch.era}</span>
                            <span>pos: {epoch.era_position}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
