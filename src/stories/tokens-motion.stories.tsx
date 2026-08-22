import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RichText } from "@/components/rich-text";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "토큰/모션",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const BuffNerf: Story = {
  name: "버프 / 너프 (게임 텍스트 효과)",
  render: () => (
    <StoryStack>
      <StoryNote>
        DESIGN.md 정본. 색은 StsColors, 애니메이션은 게임 BBCode. 스킴에 묶지 않는다.
      </StoryNote>
      <div className="space-y-3 font-game-text text-lg">
        <p>
          버프: <RichText text="[green][sine]3(4)[/sine][/green]" />
        </p>
        <p>
          너프: <RichText text="[red][jitter]2(3)[/jitter][/red]" />
        </p>
        <p>
          게임 요소: <RichText text="[gold]충격파[/gold]" />
        </p>
      </div>
    </StoryStack>
  ),
};

export const Rainbow: Story = {
  name: "rainbow (게임 태그, 서비스 의미 없음)",
  render: () => (
    <StoryStack>
      <StoryHeading>게임 BBCode</StoryHeading>
      <p className="font-game-text text-lg">
        <RichText text="[rainbow]CLANG[/rainbow]" />
      </p>
    </StoryStack>
  ),
};
