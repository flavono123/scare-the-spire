import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  SpireGhostRevealIcon,
  SpireIcon,
  SpireLikeIcon,
} from "@/components/spire-icon";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "컴포넌트/아이콘",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const SAMPLE = "/images/sts2/powers/necro_mastery_power.webp";

export const Tokens: Story = {
  render: () => (
    <StoryStack>
      <StoryNote>
        게임 토큰. 라이트모드에서 원본 픽셀을 다시 칠하지 않는다. ghost wax /
        gold hover는 서비스 상호작용이다.
      </StoryNote>
      <div className="flex items-end gap-6">
        <figure className="text-center">
          <SpireIcon src={SAMPLE} size={40} variant="ghost" />
          <figcaption className="mt-1 font-service text-xs text-muted-foreground">ghost</figcaption>
        </figure>
        <figure className="text-center">
          <SpireIcon src={SAMPLE} size={40} variant="gold" />
          <figcaption className="mt-1 font-service text-xs text-muted-foreground">gold</figcaption>
        </figure>
        <figure className="text-center">
          <SpireLikeIcon size={40} active={false} />
          <figcaption className="mt-1 font-service text-xs text-muted-foreground">like idle</figcaption>
        </figure>
        <figure className="text-center">
          <SpireLikeIcon size={40} active />
          <figcaption className="mt-1 font-service text-xs text-muted-foreground">like on</figcaption>
        </figure>
        <figure className="text-center">
          <SpireGhostRevealIcon src="/images/sts2/relics/bing_bong.webp" size={40} />
          <figcaption className="mt-1 font-service text-xs text-muted-foreground">reveal</figcaption>
        </figure>
      </div>
      <StoryHeading>조각모음 타입 토큰</StoryHeading>
      <p className="font-service text-sm text-muted-foreground">
        대기 = wax, 행 hover = 원본 색. gold로 칠하지 않는다.
      </p>
    </StoryStack>
  ),
};
