import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "토큰/타이포",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const FontRoles: Story = {
  render: () => (
    <StoryStack>
      <StoryNote>
        색 토큰보다 먼저 정리된 층. 서비스 UI와 게임 텍스트를 폰트 패밀리로
        가른다. 라이트모드에서도 이 역할은 유지한다.
      </StoryNote>
      <div className="space-y-4">
        <div>
          <StoryHeading>font-service</StoryHeading>
          <p className="font-service text-xl">슬서운이야기 서비스 카피 — 경기천년바탕</p>
        </div>
        <div>
          <StoryHeading>font-game-title</StoryHeading>
          <p className="font-game-title text-2xl spire-gold">충격파 · Bash</p>
        </div>
        <div>
          <StoryHeading>font-game-text</StoryHeading>
          <p className="font-game-text text-base text-zinc-200">
            피해를 6 줍니다. 방어도를 얻습니다.
          </p>
        </div>
      </div>
    </StoryStack>
  ),
};
