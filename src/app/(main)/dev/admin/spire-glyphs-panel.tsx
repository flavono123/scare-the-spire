import "server-only";

import { SpireGlyphsList, type GlyphAxis, type GlyphRow } from "./spire-glyphs-list";
import catalogue from "../../../../../data/dev/spire-glyphs.json";

type GlyphSource = { game?: string; path?: string; atlas?: string; region?: string; recipe?: string };
type Labels = { sound: string; type: string; cluster: string[]; parallel: string; who: string };
type GlyphItem = { id: string; labelKo: string; noteKo: string; source: GlyphSource; real: string[]; scripts: string[]; labels?: Partial<Labels> };
type GlyphFamily = { id: string; titleKo: string; noteKo: string; labels: Labels; items: GlyphItem[] };
type GlyphGroup = { families: GlyphFamily[] };

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

function sourceText(source: GlyphSource) {
  if (source.recipe) return `scripts/extract-spire-glyphs.py (${source.recipe})`;
  return source.atlas ? `${source.atlas}.atlas › ${source.region}` : (source.path ?? "");
}

// One row per capture: the item's own labels over its family's, plus what the source path tells.
const rows: GlyphRow[] = groups.flatMap((group) =>
  group.families.flatMap((family) =>
    family.items.map((item) => {
      const labels = { ...family.labels, ...item.labels };
      return {
        id: item.id,
        labelKo: item.labelKo,
        noteKo: item.noteKo,
        sourceText: sourceText(item.source),
        real: item.real,
        parallel: family.labels.parallel,
        familyNoteKo: family.noteKo,
        labels: {
          sound: [labels.sound],
          cluster: labels.cluster,
          type: [labels.type],
          scripts: item.scripts.length ? item.scripts : ["없음"],
          who: [labels.who],
          family: [family.titleKo],
          medium: [medium(item.source)],
          game: [item.source.game ? GAME_LABEL[item.source.game] : "도표"],
        },
      };
    }),
  ),
);

const note = (id: string) => catalogue.axes.find((axis) => axis.id === id)?.noteKo ?? "";
const AXES: GlyphAxis[] = [
  { id: "sound", titleKo: "소리", noteKo: note("sound") },
  { id: "cluster", titleKo: "같은 문자", noteKo: note("cluster") },
  { id: "type", titleKo: "문자 유형", noteKo: note("type") },
  { id: "scripts", titleKo: "닮은 실제 글자", noteKo: note("real") },
  { id: "who", titleKo: "쓰는 이·말하는 이", noteKo: note("who") },
  { id: "family", titleKo: "계열", noteKo: "같은 물건·인물에서 나온 그림끼리의 묶음." },
  { id: "medium", titleKo: "에셋 종류", noteKo: "원본 경로에서 읽은 에셋 종류." },
  { id: "game", titleKo: "게임", noteKo: "1편 / 2편." },
];

/** The invented writing found in the game files: one row per capture, labelled and filterable. Data: data/dev/spire-glyphs.json. */
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
        <h2 className="text-base font-semibold">레이블 읽는 법</h2>
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          {AXES.slice(0, 4).map((axis) => (
            <div key={axis.id}>
              <dt className="inline font-semibold text-foreground">{axis.titleKo}</dt>: <dd className="inline">{axis.noteKo}</dd>
            </div>
          ))}
          <div>
            <dt className="inline font-semibold text-foreground">짜임이 닮은 문자 체계</dt>: <dd className="inline">{note("parallel")}</dd>
          </div>
        </dl>
      </section>
      <SpireGlyphsList rows={rows} axes={AXES} />
    </div>
  );
}
