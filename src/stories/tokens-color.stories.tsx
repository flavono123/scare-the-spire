import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SPIRE_ICON_COLORS } from "@/components/spire-icon";
import { CHARACTER_COLORS } from "@/lib/codex-types";
import {
  TEXT_AQUA,
  TEXT_BLUE,
  TEXT_GOLD,
  TEXT_GREEN,
  TEXT_PURPLE,
  TEXT_RED,
} from "@/lib/sts2-card-style";
import { CompareTable, StoryHeading, StoryNote, StoryStack, Swatch } from "./_ui";

const meta = {
  title: "토큰/색",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const GameText: Story = {
  name: "게임 텍스트 StsColors",
  render: () => (
    <StoryStack>
      <StoryNote>
        카드 본문, `[gold]` 태그, hover tip 제목. 추출값. Tailwind 팔레트에 없다.
      </StoryNote>
      <div className="grid gap-3 sm:grid-cols-2">
        <Swatch label="TEXT_GOLD / primary" value={TEXT_GOLD} color={TEXT_GOLD} />
        <Swatch label="TEXT_GREEN 버프" value={TEXT_GREEN} color={TEXT_GREEN} />
        <Swatch label="TEXT_RED 너프" value={TEXT_RED} color={TEXT_RED} />
        <Swatch label="TEXT_BLUE 본문" value={TEXT_BLUE} color={TEXT_BLUE} />
        <Swatch label="TEXT_AQUA" value={TEXT_AQUA} color={TEXT_AQUA} />
        <Swatch label="TEXT_PURPLE" value={TEXT_PURPLE} color={TEXT_PURPLE} />
      </div>
      <p className="font-game-title text-xl">
        <span className="sts-text-gold">골드 </span>
        <span className="sts-text-green">버프 </span>
        <span className="sts-text-red">너프 </span>
        <span className="sts-text-blue">수치</span>
      </p>
    </StoryStack>
  ),
};

export const CharacterColors: Story = {
  name: "캐릭터 색 (spire-* 층)",
  render: () => (
    <StoryStack>
      <StoryNote>
        타이틀·필터용. `green-500`이 아니고, 버프 `TEXT_GREEN`도 아니다.
      </StoryNote>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(CHARACTER_COLORS).map(([id, hex]) => (
          <Swatch key={id} label={id} value={hex} color={hex} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(SPIRE_ICON_COLORS).map(([name, hex]) => (
          <Swatch
            key={name}
            label={`spire-${name}`}
            value={hex}
            color={hex}
          />
        ))}
      </div>
    </StoryStack>
  ),
};

export const SemanticSurfaces: Story = {
  name: "shadcn 의미 토큰 (다크)",
  render: () => (
    <StoryStack>
      <StoryNote>
        `--primary`는 TEXT_GOLD다. `:root`가 다크 정본이다. `html.dark`는 같은 값의 호환 클래스다.
      </StoryNote>
      <div className="grid gap-3 sm:grid-cols-2">
        <Swatch label="background" value="bg-background" className="bg-background" />
        <Swatch label="card" value="bg-card" className="bg-card" />
        <Swatch label="muted" value="bg-muted" className="bg-muted" />
        <Swatch label="primary = gold" value="bg-primary" className="bg-primary" />
        <Swatch label="border" value="border" className="bg-border" />
        <Swatch label="destructive" value="bg-destructive" className="bg-destructive" />
      </div>
      <div className="space-y-1 rounded-lg border border-border p-3">
        <p className="text-foreground">foreground — 주요 텍스트</p>
        <p className="text-muted-foreground">muted-foreground — 보조</p>
        <p className="text-primary">text-primary — 골드</p>
      </div>
    </StoryStack>
  ),
};

export const NotTheSameGreen: Story = {
  name: "green-500 ≠ spire-green ≠ 버프",
  render: () => (
    <StoryStack>
      <StoryHeading>같은 ‘green’이 셋</StoryHeading>
      <div className="grid gap-3">
        <Swatch label="Tailwind green-500" value="#22c55e" color="#22c55e" />
        <Swatch label="사일런트 / spire-green" value="#34d399" color="#34d399" />
        <Swatch label="게임 TEXT_GREEN 버프" value={TEXT_GREEN} color={TEXT_GREEN} />
      </div>
      <StoryNote>
        그래서 spire-*를 shadcn `*-nnn`에 매핑하지 않는다. 골드도 yellow-500이 아니다.
      </StoryNote>
    </StoryStack>
  ),
};
