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
        `docs/DESIGN.md`와 현재 구현은 서로 다른 정본처럼 읽힌다. 이 Storybook은
        0단계(다크 토큰 정렬) 전에 그 차이를 눈에 보이게 만든다. 문서나 코드
        한쪽만 정본으로 단정하지 말고, 여기서 어긋남을 고른 뒤 DESIGN.md를
        코드에 맞춘다.
      </StoryNote>
      <StoryHeading>보는 순서</StoryHeading>
      <CompareTable
        headers={["섹션", "역할"]}
        rows={[
          ["토큰/색", "DESIGN.md 표 vs `spire-*` vs shadcn `--primary`"],
          ["토큰/타이포·모션", "이미 맞는 층 (font-service / game-* , sine/jitter)"],
          ["컴포넌트", "같은 의도끼리 묶어 그림. 확장은 한 컴포넌트, 분기는 나란히"],
          ["재고", "복붙·지엽·이름만 다른 것. 합칠 지점"],
        ]}
      />
      <StoryNote>
        Cloudflare Worker에는 포함하지 않는다. `pnpm storybook`은 로컬 전용이다.
      </StoryNote>
    </StoryStack>
  ),
};
