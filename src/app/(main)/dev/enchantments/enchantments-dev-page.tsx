import fs from "fs/promises";
import path from "path";
import Image from "@/components/ui/static-image";
import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "인챈트 — DEV",
  description: "개발 전용: 전체 인챈트 데이터 및 아이콘 미리보기",
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

interface EnchantmentEn {
  id: string;
  name: string;
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
  return readJson<Enchantment[]>("kor/enchantments.json");
}

async function loadEnchantmentsEn(): Promise<EnchantmentEn[]> {
  return readJson<EnchantmentEn[]>("eng/enchantments.json");
}

/** Read enchantment icon filenames available on disk at build time. */
async function loadEnchantmentIconSet(): Promise<Set<string>> {
  try {
    const files = await fs.readdir(ENCHANTMENT_ICONS_DIR);
    return new Set(files.filter((f) => f.endsWith(".webp")));
  } catch {
    return new Set();
  }
}

/** Map enchantment ID (e.g. "ADROIT") to icon path, or null if missing. */
function enchantmentIconSrc(
  id: string,
  availableIcons: Set<string>,
): string | null {
  const filename = `${id.toLowerCase()}.webp`;
  if (availableIcons.has(filename)) {
    return `/images/sts2/enchantments/${filename}`;
  }
  return null;
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
      중첩 가능
    </span>
  );
}

export default async function EnchantmentsPage() {
  const [enchantments, enchantmentsEn, iconSet] = await Promise.all([
    loadEnchantments(),
    loadEnchantmentsEn(),
    loadEnchantmentIconSet(),
  ]);

  const enchEnMap = new Map(enchantmentsEn.map((e) => [e.id, e]));

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

      {/* Enchantment Icon Gallery */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-purple-400">
          인챈트 아이콘 갤러리
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {allIconFiles.length}개 아이콘 — public/images/sts2/enchantments/
        </p>
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
          {allIconFiles.map((filename) => {
            const label = filename.replace(".webp", "").replaceAll("_", " ");
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
          <StatCard label="공격" value={attackCount} color="text-red-400" />
          <StatCard label="스킬" value={skillCount} color="text-blue-400" />
          <StatCard
            label="전체 (타입 없음)"
            value={anyCount}
            color="text-zinc-400"
          />
          <StatCard
            label="중첩 가능"
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-purple-400">
                        {ench.name}
                      </h3>
                      {enchEnMap.get(ench.id)?.name && enchEnMap.get(ench.id)!.name !== ench.name && (
                        <span className="text-xs text-muted-foreground">
                          {enchEnMap.get(ench.id)!.name}
                        </span>
                      )}
                    </div>
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
                    카드 텍스트
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
        {total}개 인챈트 — STS2 데이터
      </div>
    </div>
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
