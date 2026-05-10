import fs from "fs/promises";
import path from "path";
import Image from "@/components/ui/static-image";
import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "파워 (Powers) — DEV",
  description: "개발 전용: 전체 파워/버프/디버프 데이터 및 아이콘 미리보기",
};

interface PowerKo {
  id: string;
  name: string;
  description: string;
  description_raw: string | null;
  type: "Buff" | "Debuff" | string;
  stack_type: "Counter" | "Duration" | "Intensity" | "Single" | "None" | null;
  allow_negative: boolean | null;
  image_url: string | null;
}

interface PowerEn {
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
const POWERS_ICONS_DIR = path.join(
  process.cwd(),
  "public/images/sts2/powers",
);

async function readJson<T>(relPath: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, relPath), "utf-8");
  return JSON.parse(raw) as T;
}

async function loadPowerIconSet(): Promise<Set<string>> {
  try {
    const files = await fs.readdir(POWERS_ICONS_DIR);
    return new Set(files.filter((f) => f.endsWith(".webp")));
  } catch {
    return new Set();
  }
}

function powerIconSrc(imageUrl: string | null, iconSet: Set<string>): string | null {
  if (!imageUrl) return null;
  // /static/images/powers/accelerant_power.png -> accelerant_power.webp
  const filename = imageUrl
    .replace("/static/images/powers/", "")
    .replace(".png", ".webp");
  if (iconSet.has(filename)) {
    return `/images/sts2/powers/${filename}`;
  }
  return null;
}

function TypeBadge({ type }: { type: string }) {
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

function AllowNegativeBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
      ± Negative
    </span>
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

export default async function PowersPage() {
  const [powersKo, powersEn, iconSet] = await Promise.all([
    readJson<PowerKo[]>("kor/powers.json"),
    readJson<PowerEn[]>("eng/powers.json"),
    loadPowerIconSet(),
  ]);

  // Build a map of English names by ID
  const enMap = new Map(powersEn.map((p) => [p.id, p]));

  const total = powersKo.length;
  const buffs = powersKo.filter((p) => p.type === "Buff");
  const debuffs = powersKo.filter((p) => p.type === "Debuff");
  const others = powersKo.filter((p) => p.type !== "Buff" && p.type !== "Debuff");
  const withImage = powersKo.filter((p) => powerIconSrc(p.image_url, iconSet) !== null).length;
  const withNegative = powersKo.filter((p) => p.allow_negative === true).length;

  // Build sorted list of all icon files for the gallery
  const allIconFiles = Array.from(iconSet).sort();

  const grouped = [
    { label: "버프 (Buffs)", items: buffs, color: "border-green-500/20", titleColor: "text-green-400" },
    { label: "디버프 (Debuffs)", items: debuffs, color: "border-red-500/20", titleColor: "text-red-400" },
    { label: "기타 (Others)", items: others, color: "border-zinc-500/20", titleColor: "text-zinc-400" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* DEV ONLY banner */}
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          개발 환경 전용 레퍼런스 — 프로덕션 빌드에서 숨김 처리 필요
        </span>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-cyan-400">
        파워 (Powers)
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        캐릭터/몬스터에 걸리는 버프·디버프 효과. 호버 시 툴팁으로 나타나는 게임 내 파워 시스템.
      </p>

      {/* Stats */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <StatCard label="전체" value={total} color="text-cyan-400" />
          <StatCard label="버프 (Buff)" value={buffs.length} color="text-green-400" />
          <StatCard label="디버프 (Debuff)" value={debuffs.length} color="text-red-400" />
          <StatCard label="기타 (None)" value={others.length} color="text-zinc-400" />
          <StatCard label="아이콘 있음" value={withImage} color="text-amber-400" />
          <StatCard label="음수 허용" value={withNegative} color="text-violet-400" />
        </div>
      </section>

      {/* Icon Gallery */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-cyan-400">
          파워 아이콘 갤러리
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {allIconFiles.length}개 아이콘 — public/images/sts2/powers/
        </p>
        <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {allIconFiles.map((filename) => {
            const label = filename.replace("_power.webp", "").replaceAll("_", " ");
            return (
              <div
                key={filename}
                className="flex flex-col items-center gap-1 rounded-lg border border-cyan-500/10 bg-card/30 p-1.5"
              >
                <Image
                  src={`/images/sts2/powers/${filename}`}
                  alt={label}
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                  unoptimized
                />
                <span className="text-center text-[8px] leading-tight text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Power groups */}
      {grouped.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.label} className="mt-10">
              <h2 className={`mb-4 text-lg font-semibold ${group.titleColor}`}>
                {group.label}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({group.items.length})
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((power) => {
                  const imgSrc = powerIconSrc(power.image_url, iconSet);
                  const en = enMap.get(power.id);
                  const isInternal = !power.description || power.name.endsWith("Power");
                  return (
                    <div
                      key={power.id}
                      className={`rounded-lg border ${group.color} bg-card/50 p-3 ${isInternal ? "opacity-50" : ""}`}
                    >
                      {/* Header */}
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
                          {/* Name */}
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-cyan-400">
                              {power.name}
                            </h3>
                            {en && en.name !== power.name && (
                              <span className="truncate text-xs text-muted-foreground">
                                {en.name}
                              </span>
                            )}
                          </div>
                          {/* ID + Badges */}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <code className="text-[10px] text-muted-foreground/50">
                              {power.id}
                            </code>
                            <TypeBadge type={power.type} />
                            {power.stack_type && power.stack_type !== "None" && (
                              <StackTypeBadge stackType={power.stack_type} />
                            )}
                            {power.allow_negative && <AllowNegativeBadge />}
                          </div>
                        </div>
                      </div>

                      {/* Description (Korean) */}
                      {power.description && (
                        <div className="mt-2 text-sm leading-relaxed">
                          <RichText text={power.description} />
                        </div>
                      )}

                      {/* English description */}
                      {en?.description && en.description !== power.description && (
                        <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          <RichText text={en.description} />
                        </div>
                      )}

                      {/* Raw description (template vars) */}
                      {power.description_raw && (
                        <div className="mt-1.5">
                          <code className="text-[9px] text-muted-foreground/30">
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
        {total} powers loaded from STS2 data (kor + eng)
      </div>
    </div>
  );
}
