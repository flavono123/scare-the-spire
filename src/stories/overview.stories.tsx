import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CompareTable, StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "소개/이 워크숍",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <h1 className="font-service text-2xl font-semibold text-foreground">
        슬서운이야기 디자인 워크숍
      </h1>
      <StoryNote>
        `docs/DESIGN.md`가 정본이다. 이 Storybook은 그 문서를 그린다. 다크가
        기본이고, 게임에서 뽑은 색·애셋이 Tailwind `*-500`보다 앞선다.
      </StoryNote>
      <StoryHeading>보는 순서</StoryHeading>
      <CompareTable
        headers={["섹션", "역할"]}
        rows={[
          ["토큰/색", "StsColors 골드 하나, 캐릭터 층, shadcn primary"],
          ["토큰/타이포·모션", "font-service / game-*, sine/jitter. 버프 초록은 사일런트와 다름"],
          ["컴포넌트", "호버팁 둘은 용도가 달라 각각. 좋아요는 강령의 극"],
          ["재고", "아직 안 합치는 것들. 사람말로 적어 둔 메모"],
        ]}
      />
      <StoryNote>
        Cloudflare Worker에는 포함하지 않는다. `pnpm storybook`은 로컬 전용이다.
      </StoryNote>
    </StoryStack>
  ),
};
