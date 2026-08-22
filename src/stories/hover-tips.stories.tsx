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
  name: "GameHoverTip — 리소스 설명 (게임 크롬)",
  render: () => (
    <StoryStack>
      <StoryNote>
        카드/유물 설명. hover_tip.png 9-slice, 제목색 #EFC851. 라이트모드에서도
        이 섬은 어둡게 둔다.
      </StoryNote>
      <GameHoverTip title="충격파" icon="/images/sts2/cards/ironclad/strike.webp">
        <span className="font-game-text text-sm text-[#f1eadc]">
          피해를 6 줍니다.
        </span>
      </GameHoverTip>
    </StoryStack>
  ),
};

export const ChromeTip: Story = {
  name: "GameUiHoverTip — 아이콘 라벨 (같은 애셋, 짧은 라벨)",
  render: () => (
    <StoryStack>
      <StoryNote>
        내비/좋아요/댓글. 같은 hover_tip.png를 쓰지만 컴포넌트가 둘이다.
        확장이면 하나로 합칠 수 있고, 지금은 배치(포탈 vs 인라인)가 달라 분기다.
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
  name: "나란히 — 같은 애셋, 다른 셸",
  render: () => (
    <StoryStack gap={24}>
      <StoryHeading>합칠 지점</StoryHeading>
      <StoryNote>
        9-slice 숫자(43 91 32 55)가 두 파일에 복붙돼 있다. 슬라이스 상수는
        하나로 끌어올릴 수 있다. 본문 슬롯이 있는 팁 vs 한 줄 라벨은 같은
        프레임의 확장으로 보는 편이 맞다.
      </StoryNote>
      <div className="flex flex-wrap items-start gap-8">
        <GameHoverTip title="유물 이름">
          <span className="font-game-text text-sm text-[#f1eadc]">효과 설명</span>
        </GameHoverTip>
        <GameUiHoverTip label="프로필">
          <span className="font-service text-sm text-muted-foreground">트리거</span>
        </GameUiHoverTip>
      </div>
    </StoryStack>
  ),
};
