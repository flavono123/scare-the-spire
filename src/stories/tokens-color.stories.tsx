import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SPIRE_ICON_COLORS } from "@/components/spire-icon";
import { CHARACTER_COLORS } from "@/lib/codex-types";
import { CompareTable, StoryHeading, StoryNote, StoryStack, Swatch } from "./_ui";

const meta = {
  title: "토큰/색",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const DESIGN_DOC = [
  { use: "페이지 배경", value: "bg-background / #0f0f13" },
  { use: "패널/상단바", value: "#16162a, #1a1a2e" },
  { use: "주요 텍스트", value: "#e4e4e7 / zinc-200" },
  { use: "보조 텍스트", value: "#a1a1aa / zinc-400" },
  { use: "약한 텍스트", value: "zinc-600" },
  { use: "기본 강조", value: "#eab308 / yellow-500" },
  { use: "버프", value: "green-500 + sine" },
  { use: "너프", value: "red-500 + jitter" },
  { use: "막 텍스트", value: "#60a5fa / text-blue-300" },
  { use: "막 무관", value: "zinc-400 / #666" },
] as const;

export const DesignDocTable: Story = {
  name: "DESIGN.md가 말하는 색",
  render: () => (
    <StoryStack>
      <StoryNote>
        문서의 표다. 구현 정본이 아니다. 옆 스토리와 대조한다.
      </StoryNote>
      <CompareTable
        headers={["용도", "문서 값"]}
        rows={DESIGN_DOC.map((row) => [row.use, row.value])}
      />
    </StoryStack>
  ),
};

export const ImplementedSpire: Story = {
  name: "구현 spire-* (게임 원색)",
  render: () => (
    <StoryStack>
      <StoryNote>
        `globals.css` 클래스와 `SPIRE_ICON_COLORS`. 라이트/다크에 묶이지 않는
        게임 색이다. 서비스가 글자로 빌려 쓸 때만 스킴 variant가 필요하다.
      </StoryNote>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(SPIRE_ICON_COLORS).map(([name, hex]) => (
          <Swatch
            key={name}
            label={`spire-${name}`}
            value={hex}
            color={hex}
          />
        ))}
        <Swatch label="spire-silver" value="#8ad6e0" color="#8ad6e0" />
        <Swatch label="spire-bronze" value="#d7a470" color="#d7a470" />
      </div>
      <p className="font-game-title text-xl">
        <span className="spire-gold">골드 글자 </span>
        <span className="spire-aqua">아쿠아 글자 </span>
        <span className="spire-blue">막 파랑</span>
      </p>
    </StoryStack>
  ),
};

export const CharacterColors: Story = {
  name: "캐릭터 색 (DESIGN 의미 = 구현 hex)",
  render: () => (
    <StoryStack>
      <StoryNote>
        DESIGN.md는 이름만 적는다 (red/green/orange/pink/aqua).
        `CHARACTER_COLORS`는 `spire-*`와 같은 hex다. 이 층은 이미 맞다.
      </StoryNote>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(CHARACTER_COLORS).map(([id, hex]) => (
          <Swatch key={id} label={id} value={hex} color={hex} />
        ))}
      </div>
    </StoryStack>
  ),
};

export const SemanticSurfaces: Story = {
  name: "shadcn 의미 토큰 (다크 클래스 안)",
  render: () => (
    <StoryStack>
      <StoryNote>
        `html.dark`일 때 `--background` 등. 사이트는 이 토큰보다 zinc/hex를
        더 많이 쓴다. `--primary`는 골드가 아니라 밝은 회색이다.
      </StoryNote>
      <div className="grid gap-3 sm:grid-cols-2">
        <Swatch label="background" value="bg-background" className="bg-background" />
        <Swatch label="card" value="bg-card" className="bg-card" />
        <Swatch label="muted" value="bg-muted" className="bg-muted" />
        <Swatch label="primary (NOT gold)" value="bg-primary" className="bg-primary" />
        <Swatch label="border" value="border" className="bg-border" />
        <Swatch label="destructive" value="bg-destructive" className="bg-destructive" />
      </div>
      <div className="space-y-1 rounded-lg border border-border p-3">
        <p className="text-foreground">foreground — 주요 텍스트</p>
        <p className="text-muted-foreground">muted-foreground — 보조</p>
        <p className="text-primary">text-primary — 제품 primary가 아님</p>
      </div>
    </StoryStack>
  ),
};

export const ThreeGolds: Story = {
  name: "골드가 셋",
  render: () => (
    <StoryStack>
      <StoryHeading>같은 ‘강조’가 세 hex</StoryHeading>
      <div className="grid gap-3">
        <Swatch label="DESIGN.md yellow-500" value="#eab308" color="#eab308" />
        <Swatch label="spire-gold / 서비스" value="#d4a843" color="#d4a843" />
        <Swatch label="게임 hover tip #EFC851" value="#EFC851" color="#EFC851" />
      </div>
      <StoryNote>
        게임 크롬(hover tip 제목)은 #EFC851을 유지해야 한다. 서비스 강조/게임
        리소스 링크는 spire-gold. DESIGN.md의 yellow-500은 문서 오류로 본다.
      </StoryNote>
    </StoryStack>
  ),
};
