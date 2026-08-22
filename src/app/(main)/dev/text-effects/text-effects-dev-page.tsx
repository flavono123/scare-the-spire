import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "텍스트 효과 레퍼런스 — DEV",
  description: "개발 전용: Spire BBCode 텍스트 효과 카탈로그",
};

const COLOR_SAMPLES = [
  { tag: "gold", hex: "#EFC851", label: "Gold", desc: "StsColors TEXT_GOLD. 카드/유물 강조, primary" },
  { tag: "red", hex: "#FF5555", label: "Red", desc: "StsColors TEXT_RED. 너프 [red], 아이언클래드와 다름" },
  { tag: "green", hex: "#7FFF00", label: "Green", desc: "StsColors TEXT_GREEN. 버프 [green], 사일런트와 다름" },
  { tag: "aqua", hex: "#2AEBBE", label: "Aqua", desc: "StsColors TEXT_AQUA. 디펙트 캐릭터색과 다름" },
  { tag: "orange", hex: "#fb923c", label: "Orange", desc: "리젠트 캐릭터 색. 게임 본문 태그 없음" },
  { tag: "pink", hex: "#f472b6", label: "Pink", desc: "네크로바인더 캐릭터 색. 게임 본문 태그 없음" },
  { tag: "blue", hex: "#87CEEB", label: "Blue", desc: "StsColors TEXT_BLUE. 막 파랑(#60a5fa)과 다름" },
  { tag: "purple", hex: "#EE82EE", label: "Purple", desc: "StsColors TEXT_PURPLE. 인챈트 제목" },
];

const BADGE_RANK_COLOR_SAMPLES = [
  { className: "spire-gold", hex: "#EFC851", label: "Gold" },
  { className: "spire-silver", hex: "#8ad6e0", label: "Silver" },
  { className: "spire-bronze", hex: "#d7a470", label: "Bronze" },
];

const EFFECT_SAMPLES = [
  {
    tag: "sine",
    css: "rich-sine",
    label: "Sine (파동)",
    desc: "부드러운 위아래 움직임. 영묘하고 신비로운 느낌.",
    example: "[sine]swirling vortex of glowing sigils[/sine]",
    keyframes: "translateY(0) → translateY(-2px) → translateY(0), 2s ease-in-out infinite",
  },
  {
    tag: "jitter",
    css: "rich-jitter",
    label: "Jitter (떨림)",
    desc: "빠르게 흔들리는 텍스트. 폭력적이고 긴박한 느낌.",
    example: "[jitter]CLANG! CLANG!!![/jitter]",
    keyframes: "translate(0,0) → (-1px,1px) → (1px,-1px) → (-1px,-1px), 0.15s infinite",
  },
];

const BUFF_NERF_EXAMPLES = [
  {
    label: "버프 (Green + Sine)",
    bbcode: "[green][sine]버프된 값이나 텍스트[/sine][/green]",
    desc: "패치노트 원문에서 명시적으로 버프된 항목에 적용.",
  },
  {
    label: "너프 (Red + Jitter)",
    bbcode: "[red][jitter]너프된 값이나 텍스트[/jitter][/red]",
    desc: "패치노트 원문에서 명시적으로 너프된 항목에 적용.",
  },
];

const NESTING_EXAMPLES = [
  { bbcode: "[gold][sine]swirling vortex of glowing sigils[/sine][/gold]", label: "Gold + Sine" },
  { bbcode: "[jitter][red]swarm of aggressive insects[/red][/jitter]", label: "Jitter + Red" },
  { bbcode: "[sine][purple]haunting, melodic tones[/purple][/sine]", label: "Sine + Purple" },
  { bbcode: "[b][jitter]CLANG! CLANG!!![/jitter][/b]", label: "Bold + Jitter" },
  { bbcode: "[aqua][sine]eerily-glowing water[/sine][/aqua]", label: "Aqua + Sine" },
];

const USAGE_EXAMPLES = [
  {
    label: "엔티티 강조",
    bbcode: "이제 [gold]소멸[/gold]됨. [gold]집중[/gold]을 더 이상 부여하지 않음.",
  },
  {
    label: "캐릭터 섹션",
    bbcode: "[red]아이언클래드[/red] / [green]사일런트[/green] / [aqua]디펙트[/aqua] / [orange]리젠트[/orange] / [pink]네크로바인더[/pink]",
  },
  {
    label: "고대의 존재",
    bbcode: "[blue]고대의 존재[/blue] 관련 변경",
  },
  {
    label: "버프 표현",
    bbcode: "[gold]영혼 포획[/gold]: 적 HP [green][sine]3(4)[/sine][/green] 감소 (이전: 2(3))",
  },
  {
    label: "너프 표현",
    bbcode: "[gold]정렬[/gold]: 비용 [red][jitter]별 3개[/jitter][/red]로 증가 (이전: 별 2개)",
  },
];

export default function TextEffectsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          개발 환경 전용 레퍼런스 — 프로덕션 빌드에서 숨김 처리 필요
        </span>
      </div>

      <h1 className="text-2xl font-bold">텍스트 효과 레퍼런스</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        인게임 BBCode 색상 + 애니메이션 기반 텍스트 효과 카탈로그
      </p>

      {/* Colors */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">색상 (Colors)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          STS2 인게임 BBCode 색상. [tag]...[/tag] 형식.
        </p>
        <div className="space-y-2">
          {COLOR_SAMPLES.map((c) => (
            <div
              key={c.tag}
              className="flex items-center gap-4 rounded border border-border bg-card/50 px-4 py-3"
            >
              <div
                className="h-6 w-6 rounded-full border border-border shrink-0"
                style={{ backgroundColor: c.hex }}
              />
              <div className="w-20 shrink-0">
                <code className="text-xs text-muted-foreground">[{c.tag}]</code>
              </div>
              <div className="flex-1">
                <RichText
                  text={`[${c.tag}]${c.label} — 이것은 ${c.tag} 색상 텍스트입니다[/${c.tag}]`}
                  className="text-sm"
                />
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {c.hex}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-yellow-500">뱃지 등급 (Badge Ranks)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          금은 기존 강조색, 은·동은 뱃지 베이스 에셋의 밝은 테두리 대표색.
        </p>
        <div className="space-y-2">
          {BADGE_RANK_COLOR_SAMPLES.map((sample) => (
            <div
              key={sample.className}
              className="flex items-center gap-4 rounded border border-border bg-card/50 px-4 py-3"
            >
              <div
                className="h-6 w-6 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: sample.hex }}
              />
              <code className="w-28 shrink-0 text-xs text-muted-foreground">.{sample.className}</code>
              <span className={`${sample.className} flex-1 text-sm`}>{sample.label}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{sample.hex}</span>
            </div>
          ))}
        </div>
      </section>

      {/* In-game Effects */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">인게임 애니메이션 (In-game Effects)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          STS2 인게임 텍스트 애니메이션.
        </p>
        <div className="space-y-3">
          {EFFECT_SAMPLES.map((e) => (
            <div
              key={e.tag}
              className="rounded border border-border bg-card/50 px-4 py-3"
            >
              <div className="flex items-center gap-3 mb-2">
                <code className="text-xs bg-zinc-800 px-2 py-0.5 rounded">[{e.tag}]</code>
                <span className="text-sm font-medium">{e.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{e.desc}</p>
              <div className="text-lg mb-2">
                <RichText text={e.example} />
              </div>
              <code className="text-[10px] text-muted-foreground/60">{e.keyframes}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Buff/Nerf Indicators */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">버프 / 너프 표현</h2>
        <p className="text-xs text-muted-foreground mb-3">
          인게임 애니메이션 + 캐릭터 색상을 조합. 패치노트 원문에서 명시적 버프/너프에만 적용.
        </p>
        <div className="space-y-3">
          {BUFF_NERF_EXAMPLES.map((e, i) => (
            <div
              key={i}
              className="rounded border border-border bg-card/50 px-4 py-3"
            >
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {e.label}
              </span>
              <p className="text-xs text-muted-foreground mb-2">{e.desc}</p>
              <div className="text-lg mb-2">
                <RichText text={e.bbcode} />
              </div>
              <code className="text-[10px] text-muted-foreground/60">{e.bbcode}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Nesting */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">중첩 (Nesting)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          색상 + 효과 중첩 예시. 인게임에서 자주 사용됨.
        </p>
        <div className="space-y-2">
          {NESTING_EXAMPLES.map((n, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded border border-border bg-card/50 px-4 py-3"
            >
              <span className="text-xs text-muted-foreground w-28 shrink-0">
                {n.label}
              </span>
              <div className="text-sm flex-1">
                <RichText text={n.bbcode} />
              </div>
              <code className="text-[10px] text-muted-foreground/60 shrink-0 max-w-60 truncate">
                {n.bbcode}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* Usage Examples */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">슬서운변경 사용 예시</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Rich 패치노트에서의 실제 사용 패턴.
        </p>
        <div className="space-y-3">
          {USAGE_EXAMPLES.map((p, i) => (
            <div
              key={i}
              className="rounded border border-border bg-card/50 px-4 py-3"
            >
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {p.label}
              </span>
              <div className="text-sm mb-2">
                <RichText text={p.bbcode} />
              </div>
              <code className="text-[10px] text-muted-foreground/60">{p.bbcode}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Usage Guide */}
      <section className="mt-8 mb-12">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">사용법</h2>
        <div className="rounded border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground space-y-2">
          <p>
            <code className="bg-zinc-800 px-1 rounded">{`<RichText text="[gold]방어도[/gold]를 [gold]5[/gold] 획득" />`}</code>
          </p>
          <p>버프/너프 BBCode:</p>
          <p>
            <code className="bg-zinc-800 px-1 rounded">{`<RichText text="[green][sine]버프된 값[/sine][/green]" />`}</code>
          </p>
          <p>
            <code className="bg-zinc-800 px-1 rounded">{`<RichText text="[red][jitter]너프된 값[/jitter][/red]" />`}</code>
          </p>
        </div>
      </section>
    </div>
  );
}
