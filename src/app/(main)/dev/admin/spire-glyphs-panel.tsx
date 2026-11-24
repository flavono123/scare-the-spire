import "server-only";

import catalogue from "../../../../../data/dev/spire-glyphs.json";

type GlyphSource = { game?: string; path?: string; atlas?: string; region?: string; recipe?: string };
type GlyphItem = { id: string; labelKo: string; noteKo: string; source: GlyphSource };
type GlyphFamily = { id: string; titleKo: string; noteKo: string; labels: Record<string, string>; items: GlyphItem[] };
type GlyphGroup = { id: string; titleKo: string; noteKo: string; families: GlyphFamily[] };

const groups = catalogue.groups as GlyphGroup[];
const GAME_LABEL: Record<string, string> = { sts1: "1편", sts2: "2편" };
// First match wins; the asset kind is read off the source path so it never drifts from the data.
const MEDIA: [RegExp, string][] = [
  [/timeline|era_atlas/, "연대표"],
  [/ortraits/, "카드 그림"],
  [/vfx\//, "VFX"],
  [/relics/i, "유물"],
  [/events\//, "이벤트 그림"],
  [/backgrounds\/|rooms\/|Scene\//, "방 배경"],
  [/ancients\//, "고대의 존재 그림"],
  [/potions\//, "포션"],
  [/powers\/|enchantments\//, "아이콘"],
  [/ui\/|common_ui|blights\/|packed\/fool\//, "UI"],
];

function medium(source: GlyphSource) {
  if (source.recipe) return "대조 도표";
  if (source.atlas) return "Spine 뼈대";
  return MEDIA.find(([pattern]) => pattern.test(source.path ?? ""))?.[1] ?? "기타";
}

const unique = (values: string[]) => [...new Set(values)].join(", ");
const games = (family: GlyphFamily) => unique(family.items.flatMap((item) => (item.source.game ? [GAME_LABEL[item.source.game]] : [])));

function sourceText(source: GlyphSource) {
  if (source.recipe) return `scripts/extract-spire-glyphs.py (${source.recipe})`;
  return source.atlas ? `${source.atlas}.atlas › ${source.region}` : source.path;
}

/** The invented writing found in the game files as a flat list labelled along several axes. Data: data/dev/spire-glyphs.json. */
export function SpireGlyphsPanel() {
  return (
    <div className="mt-6 space-y-10">
      <section>
        <h2 className="text-base font-semibold">게임 내 문자 정리</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          기준 빌드 2편 v{catalogue.archiveVersion}, 1편 설치본. 목록은 <code>data/dev/spire-glyphs.json</code>, 이미지는{" "}
          <code>python3 scripts/extract-spire-glyphs.py</code>로 다시 뽑는다.
        </p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {catalogue.findings.map((finding) => (
            <li key={finding.titleKo} className="rounded-md border border-border bg-card/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-primary">{finding.titleKo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{finding.bodyKo}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{catalogue.coverageKo}</p>
      </section>
      <section>
        <h2 className="text-lg font-bold">레이블 한눈에 보기</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground md:grid-cols-2">
          {catalogue.axes.map((axis) => (
            <div key={axis.id}>
              <dt className="inline font-semibold text-foreground">{axis.titleKo}</dt>: <dd className="inline">{axis.noteKo}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[1400px] border-collapse text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1.5">글자</th>
                {catalogue.axes.map((axis) => (
                  <th key={axis.id} className="px-2 py-1.5">
                    {axis.titleKo}
                  </th>
                ))}
                <th className="px-2 py-1.5">에셋 종류</th>
                <th className="px-2 py-1.5">게임</th>
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((group) =>
                group.families.map((family) => (
                  <tr key={family.id} className="border-t border-border align-top">
                    <th className="px-2 py-1.5 font-semibold">
                      <a href={`#glyph-${family.id}`} className="hover:underline">
                        {family.titleKo}
                      </a>
                    </th>
                    {catalogue.axes.map((axis) => (
                      <td key={axis.id} className="px-2 py-1.5 text-muted-foreground">
                        {family.labels[axis.id]}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-muted-foreground">{unique(family.items.map((item) => medium(item.source)))}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{games(family)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="text-lg font-bold">{group.titleKo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{group.noteKo}</p>
          {group.families.map((family) => (
            <div key={family.id} id={`glyph-${family.id}`} className="mt-5 scroll-mt-20 rounded-md border border-border bg-card/40 px-4 py-4">
              <h3 className="text-base font-semibold">
                {family.titleKo} <span className="text-xs font-normal text-muted-foreground">{family.items.length}점</span>
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{family.noteKo}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {catalogue.axes.map((axis) => (
                  <li key={axis.id} className="rounded border border-border bg-background/60 px-2 py-0.5 text-xs">
                    <span className="text-muted-foreground">{axis.titleKo}</span> {family.labels[axis.id]}
                  </li>
                ))}
              </ul>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {family.items.map((item) => (
                  <li key={item.id} className="flex flex-col rounded-md border border-border bg-background/60 p-3">
                    <div className="flex h-44 items-center justify-center rounded bg-[#18181e]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- dev-only image served from data/dev */}
                      <img
                        src={`/api/dev/spire-glyphs/${item.id}.webp`}
                        alt={item.labelKo}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="mt-2 text-sm font-semibold">
                      {item.labelKo}
                      {item.source.game && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          {GAME_LABEL[item.source.game]}
                        </span>
                      )}
                      <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                        {medium(item.source)}
                      </span>
                    </div>
                    {item.noteKo && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.noteKo}</p>}
                    <code className="mt-auto break-all pt-2 text-[10px] text-muted-foreground/80">{sourceText(item.source)}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
