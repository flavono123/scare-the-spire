import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "텍스트 효과 레퍼런스 — DEV",
  description: "개발 전용: Spire BBCode 텍스트 효과 카탈로그",
};

const COLOR_SAMPLES = [
  { tag: "gold", hex: "#d4a843", label: "Gold", desc: "게임 키워드 (Vulnerable, Block, Strength, Deck 등)" },
  { tag: "blue", hex: "#60a5fa", label: "Blue", desc: "수치 값 (데미지, 방어도, 카운트)" },
  { tag: "red", hex: "#f87171", label: "Red", desc: "부정적 효과, 저주, 위험 텍스트" },
  { tag: "green", hex: "#34d399", label: "Green", desc: "회복량, 자연 요소, 긍정적 효과" },
  { tag: "purple", hex: "#c084fc", label: "Purple", desc: "인챈트 이름, 신비로운 텍스트" },
  { tag: "orange", hex: "#fb923c", label: "Orange", desc: "캐릭터, 크리처, 불 관련" },
  { tag: "pink", hex: "#f472b6", label: "Pink", desc: "캐릭터 이름 (네크로바인더 등)" },
  { tag: "aqua", hex: "#22d3ee", label: "Aqua", desc: "물/정령 관련, 특수 NPC" },
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

const CUSTOM_EFFECTS = [
  {
    css: "rich-nerf-shake",
    label: "Nerf Shake (너프 흔들림)",
    desc: "패치 노트에서 너프된 수치에 사용. 좌우로 떨리는 효과.",
    keyframes: "translate(-2px,0) → (2px,0) → (-1px,0) → (1px,0), 0.5s infinite",
  },
  {
    css: "rich-buff-pulse",
    label: "Buff Pulse (버프 맥동)",
    desc: "패치 노트에서 버프된 수치에 사용. 글자 주변에 빛이 맥동.",
    keyframes: "text-shadow: 0 0 0 → 0 0 8px currentColor, 2s ease-in-out infinite",
  },
  {
    css: "rich-rainbow",
    label: "Rainbow (무지개)",
    desc: "특수 텍스트. 색이 연속으로 변화.",
    keyframes: "color: red → orange → yellow → green → blue → purple, 3s linear infinite",
  },
];

const NESTING_EXAMPLES = [
  { bbcode: "[gold][sine]swirling vortex of glowing sigils[/sine][/gold]", label: "Gold + Sine" },
  { bbcode: "[jitter][red]swarm of aggressive insects[/red][/jitter]", label: "Jitter + Red" },
  { bbcode: "[sine][purple]haunting, melodic tones[/purple][/sine]", label: "Sine + Purple" },
  { bbcode: "[b][jitter]CLANG! CLANG!!![/jitter][/b]", label: "Bold + Jitter" },
  { bbcode: "[aqua][sine]eerily-glowing water[/sine][/aqua]", label: "Aqua + Sine" },
];

const PATCH_NOTE_EXAMPLES = [
  {
    label: "너프 표현",
    bbcode: "Cost: [red][b]0[/b][/red] → [green][b]1[/b][/green]",
    desc: "숫자 변경 시 before=red, after=green 으로 표현",
  },
  {
    label: "너프 (흔들림 적용)",
    html: '<span class="rich-nerf-shake spire-red">Prepared</span> → <span class="spire-green">Prepare</span>',
  },
  {
    label: "버프 (맥동 적용)",
    html: '<span class="rich-buff-pulse spire-green">3장</span>',
  },
  {
    label: "키워드",
    bbcode: "이제 [gold]소멸[/gold]됨. [gold]집중[/gold]을 더 이상 부여하지 않음.",
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
        Spire BBCode 텍스트 컬러, 애니메이션, 패치노트 전용 효과 카탈로그
      </p>

      {/* Colors */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">색상 (Colors)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          spire-codex.com / 인게임 BBCode 색상. [tag]...[/tag] 형식.
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

      {/* In-game Effects */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">인게임 애니메이션 (In-game Effects)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          spire-codex.com과 동일. STS2 인게임 텍스트 애니메이션.
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

      {/* Custom Patch Effects */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">패치노트 전용 효과 (Custom Effects)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          인게임에 없는 커스텀 효과. 패치노트 밸런스 변경 표시용.
        </p>
        <div className="space-y-3">
          {CUSTOM_EFFECTS.map((e) => (
            <div
              key={e.css}
              className="rounded border border-border bg-card/50 px-4 py-3"
            >
              <div className="flex items-center gap-3 mb-2">
                <code className="text-xs bg-zinc-800 px-2 py-0.5 rounded">.{e.css}</code>
                <span className="text-sm font-medium">{e.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{e.desc}</p>
              <div className="text-lg mb-2">
                <span className={e.css}>
                  이 텍스트에 {e.label} 효과가 적용됩니다
                </span>
              </div>
              <code className="text-[10px] text-muted-foreground/60">{e.keyframes}</code>
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

      {/* Patch Note Patterns */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">패치노트 표현 패턴</h2>
        <p className="text-xs text-muted-foreground mb-3">
          밸런스 변경을 표현할 때 사용할 패턴. 너프=흔들림, 버프=맥동.
        </p>
        <div className="space-y-3">
          {PATCH_NOTE_EXAMPLES.map((p, i) => (
            <div
              key={i}
              className="rounded border border-border bg-card/50 px-4 py-3"
            >
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {p.label}
              </span>
              <div className="text-sm">
                {p.bbcode ? (
                  <RichText text={p.bbcode} />
                ) : p.html ? (
                  <span dangerouslySetInnerHTML={{ __html: p.html }} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Usage Guide */}
      <section className="mt-8 mb-12">
        <h2 className="text-lg font-semibold text-yellow-500 mb-4">사용법</h2>
        <div className="rounded border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground space-y-2">
          <p>
            <code className="bg-zinc-800 px-1 rounded">{`<RichText text="[gold]Block[/gold]을 [blue]5[/blue] 획득" />`}</code>
          </p>
          <p>CSS 클래스 직접 사용:</p>
          <p>
            <code className="bg-zinc-800 px-1 rounded">{`<span className="spire-gold">Block</span>`}</code>
          </p>
          <p>
            <code className="bg-zinc-800 px-1 rounded">{`<span className="rich-nerf-shake spire-red">너프된 값</span>`}</code>
          </p>
        </div>
      </section>
    </div>
  );
}
