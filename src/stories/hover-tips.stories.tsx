import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GameHoverTip } from "@/components/codex/hover-tip";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "컴포넌트/호버 팁",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ResourceTip: Story = {
  name: "GameHoverTip — 리소스 설명",
  render: () => (
    <StoryStack>
      <StoryNote>
        카드/유물 이름과 효과. 인라인. 라이트모드가 와도 이 섬은 게임 크롬이다.
      </StoryNote>
      <GameHoverTip title="충격파" icon="/images/sts2/cards/ironclad/strike.webp">
        <span className="font-game-text text-sm sts-text-cream">
          피해를 6 줍니다.
        </span>
      </GameHoverTip>
    </StoryStack>
  ),
};

export const ChromeTip: Story = {
  name: "GameUiHoverTip — 아이콘 라벨",
  render: () => (
    <StoryStack>
      <StoryNote>
        내비/좋아요/댓글. 한 줄 라벨을 포탈한다. 용도가 달라 컴포넌트는 둘이다.
        9-slice 숫자와 제목색만 공유한다.
      </StoryNote>
      <GameUiHoverTip label="첫 댓글 쓰기">
        <button
          type="button"
          className="rounded border border-border px-3 py-1.5 font-service text-sm text-foreground"
        >
          포인터를 올리세요
        </button>
      </GameUiHoverTip>
    </StoryStack>
  ),
};

export const SideBySide: Story = {
  name: "나란히 — 합치지 않음",
  render: () => (
    <StoryStack gap={24}>
      <StoryHeading>같은 그림, 다른 말풍선</StoryHeading>
      <div className="flex flex-wrap items-start gap-8">
        <GameHoverTip title="유물 이름">
          <span className="font-game-text text-sm sts-text-cream">효과 설명</span>
        </GameHoverTip>
        <GameUiHoverTip label="프로필">
          <span className="font-service text-sm text-muted-foreground">트리거</span>
        </GameUiHoverTip>
      </div>
    </StoryStack>
  ),
};
