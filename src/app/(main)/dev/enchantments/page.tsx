import fs from "fs/promises";
import path from "path";
import Image from "next/image";
import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "인챈트 & 파워 — DEV",
  description: "개발 전용: 전체 인챈트/파워 데이터 및 효과 미리보기",
};

interface Enchantment {
  id: string;
  name: string;
  description: string;
  description_raw: string | null;
  extra_card_text: string | null;
  card_type: "Attack" | "Skill" | null;
  is_stackable: boolean;
  image_url: string | null;
}

interface RawPower {
  id: string;
  name: string;
  description: string;
  description_raw: string | null;
  type: "Buff" | "Debuff" | string;
  stack_type: "Counter" | "Duration" | "Intensity" | "Single" | "None" | null;
  allow_negative: boolean | null;
  image_url: string | null;
}

const DATA_DIR = path.join(process.cwd(), "data/sts2");
const ENCHANTMENT_ICONS_DIR = path.join(
  process.cwd(),
  "public/images/sts2/enchantments",
);

async function readJson<T>(relPath: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, relPath), "utf-8");
  return JSON.parse(raw) as T;
}

async function loadEnchantments(): Promise<Enchantment[]> {
  return readJson<Enchantment[]>("eng/enchantments.json");
}

async function loadPowers(): Promise<RawPower[]> {
  return readJson<RawPower[]>("eng/powers.json");
}

/** Read enchantment icon filenames available on disk at build time. */
async function loadEnchantmentIconSet(): Promise<Set<string>> {
  try {
    const files = await fs.readdir(ENCHANTMENT_ICONS_DIR);
    return new Set(files.filter((f) => f.endsWith(".png")));
  } catch {
    return new Set();
  }
}

/** Map enchantment ID (e.g. "ADROIT") to icon path, or null if missing. */
function enchantmentIconSrc(
  id: string,
  availableIcons: Set<string>,
): string | null {
  const filename = `${id.toLowerCase()}.png`;
  if (availableIcons.has(filename)) {
    return `/images/sts2/enchantments/${filename}`;
  }
  return null;
}

function powerImageSrc(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return imageUrl.replace("/static/images/powers/", "/images/sts2/powers/");
}

function CardTypeBadge({ type }: { type: "Attack" | "Skill" }) {
  const styles =
    type === "Attack"
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles}`}
    >
      {type}
    </span>
  );
}

function StackableBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="h-3 w-3"
        aria-hidden="true"
      >
        <path d="M8 1l2 3h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" />
        <path d="M8 5l1.2 1.8h2.4l-1.8 1.8.6 2.4-2.4-1.2-2.4 1.2.6-2.4-1.8-1.8h2.4z" opacity="0.5" />
      </svg>
      Stackable
    </span>
  );
}

function PowerTypeBadge({ type }: { type: string }) {
  const styles =
    type === "Buff"
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : type === "Debuff"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles}`}
    >
      {type}
    </span>
  );
}

function StackTypeBadge({ stackType }: { stackType: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400">
      {stackType}
    </span>
  );
}

export default async function EnchantmentsPage() {
  const [enchantments, powers, iconSet] = await Promise.all([
    loadEnchantments(),
    loadPowers(),
    loadEnchantmentIconSet(),
  ]);

  const total = enchantments.length;
  const stackableCount = enchantments.filter((e) => e.is_stackable).length;
  const attackCount = enchantments.filter(
    (e) => e.card_type === "Attack",
  ).length;
  const skillCount = enchantments.filter(
    (e) => e.card_type === "Skill",
  ).length;
  const anyCount = enchantments.filter((e) => e.card_type === null).length;

  // Build sorted list of all icon files for the gallery
  const allIconFiles = Array.from(iconSet).sort();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* DEV ONLY banner */}
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          개발 환경 전용 레퍼런스 — 프로덕션 빌드에서 숨김 처리 필요
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Enchantment Icon Gallery */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-purple-400">
          인챈트 아이콘 갤러리
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {allIconFiles.length}개 아이콘 — public/images/sts2/enchantments/
        </p>
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
          {allIconFiles.map((filename) => {
            const label = filename.replace(".png", "").replaceAll("_", " ");
            return (
              <div
                key={filename}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-purple-500/10 bg-card/30 p-2"
              >
                <Image
                  src={`/images/sts2/enchantments/${filename}`}
                  alt={label}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                  unoptimized
                />
                <span className="text-center text-[9px] leading-tight text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Title */}
      <h1 className="text-2xl font-bold text-purple-400">인챈트</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        DEV — 전체 인챈트 데이터 및 효과 미리보기
      </p>

      {/* Stats */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="전체" value={total} color="text-purple-400" />
          <StatCard label="Attack" value={attackCount} color="text-red-400" />
          <StatCard label="Skill" value={skillCount} color="text-blue-400" />
          <StatCard
            label="Any (타입 없음)"
            value={anyCount}
            color="text-zinc-400"
          />
          <StatCard
            label="Stackable"
            value={stackableCount}
            color="text-amber-400"
          />
        </div>
      </section>

      {/* Enchantment cards grid */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {enchantments.map((ench) => {
          const iconSrc = enchantmentIconSrc(ench.id, iconSet);
          return (
            <div
              key={ench.id}
              className="rounded-lg border border-purple-500/20 bg-card/50 p-4"
            >
              {/* Header with icon */}
              <div className="flex items-start gap-3">
                {iconSrc ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-purple-500/30 bg-zinc-900">
                    <Image
                      src={iconSrc}
                      alt={ench.name}
                      fill
                      className="object-contain p-0.5"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-purple-500/20 bg-zinc-900 text-xs text-muted-foreground/40">
                    ?
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-purple-400">
                      {ench.name}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {ench.card_type && (
                        <CardTypeBadge type={ench.card_type} />
                      )}
                      {ench.is_stackable && <StackableBadge />}
                    </div>
                  </div>
                  {/* ID */}
                  <code className="mt-0.5 block text-[10px] text-muted-foreground/50">
                    {ench.id}
                  </code>
                </div>
              </div>

              {/* Description */}
              <div className="mt-3 text-sm leading-relaxed">
                <RichText text={ench.description} />
              </div>

              {/* Extra card text */}
              {ench.extra_card_text && (
                <div className="mt-3 rounded border border-zinc-700/50 bg-zinc-800/50 px-3 py-2">
                  <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                    Card Text
                  </span>
                  <div className="text-xs leading-relaxed text-zinc-300">
                    <RichText text={ench.extra_card_text} />
                  </div>
                </div>
              )}

              {/* Raw description (template vars) */}
              {ench.description_raw && (
                <div className="mt-2">
                  <code className="text-[10px] text-muted-foreground/40">
                    raw: {ench.description_raw}
                  </code>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="mt-8 mb-12 text-center text-xs text-muted-foreground/40">
        {total} enchantments loaded from STS2 data
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Powers Section */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <PowersSection powers={powers} />
    </div>
  );
}

function PowersSection({ powers }: { powers: RawPower[] }) {
  const totalPowers = powers.length;
  const buffs = powers.filter((p) => p.type === "Buff");
  const debuffs = powers.filter((p) => p.type === "Debuff");
  const others = powers.filter((p) => p.type !== "Buff" && p.type !== "Debuff");
  const withImage = powers.filter((p) => p.image_url !== null).length;

  const grouped = [
    { label: "Buffs", items: buffs, color: "border-green-500/20" },
    { label: "Debuffs", items: debuffs, color: "border-red-500/20" },
    { label: "Others", items: others, color: "border-zinc-500/20" },
  ];

  return (
    <>
      <div className="mt-12 border-t border-border pt-8">
        <h1 className="text-2xl font-bold text-cyan-400">
          파워 / 버프 / 디버프 (Powers)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          DEV — 전체 파워 데이터 및 아이콘 미리보기
        </p>
      </div>

      {/* Power Stats */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="전체" value={totalPowers} color="text-cyan-400" />
          <StatCard label="Buff" value={buffs.length} color="text-green-400" />
          <StatCard
            label="Debuff"
            value={debuffs.length}
            color="text-red-400"
          />
          <StatCard
            label="이미지 있음"
            value={withImage}
            color="text-amber-400"
          />
        </div>
      </section>

      {/* Power groups */}
      {grouped.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.label} className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
                {group.label}{" "}
                <span className="text-sm font-normal">
                  ({group.items.length})
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.items.map((power) => {
                  const imgSrc = powerImageSrc(power.image_url);
                  return (
                    <div
                      key={power.id}
                      className={`rounded-lg border ${group.color} bg-card/50 p-4`}
                    >
                      {/* Header with icon */}
                      <div className="flex items-start gap-3">
                        {imgSrc ? (
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-zinc-900">
                            <Image
                              src={imgSrc}
                              alt={power.name}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-zinc-900 text-xs text-muted-foreground/40">
                            ?
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-cyan-400">
                              {power.name}
                            </h3>
                            <PowerTypeBadge type={power.type} />
                          </div>
                          <code className="mt-0.5 block text-[10px] text-muted-foreground/50">
                            {power.id}
                          </code>
                          {power.stack_type &&
                            power.stack_type !== "None" && (
                              <div className="mt-1">
                                <StackTypeBadge
                                  stackType={power.stack_type}
                                />
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Description */}
                      {power.description && (
                        <div className="mt-3 text-sm leading-relaxed">
                          <RichText text={power.description} />
                        </div>
                      )}

                      {/* Raw description */}
                      {power.description_raw && (
                        <div className="mt-2">
                          <code className="text-[10px] text-muted-foreground/40">
                            raw: {power.description_raw}
                          </code>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ),
      )}

      <div className="mt-8 mb-12 text-center text-xs text-muted-foreground/40">
        {totalPowers} powers loaded from STS2 data
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded border border-border bg-card/50 px-3 py-2 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
