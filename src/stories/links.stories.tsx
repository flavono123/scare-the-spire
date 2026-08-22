import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "컴포넌트/링크",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Roles: Story = {
  name: "역할별 색 — 지금은 유틸이 갈라짐",
  render: () => (
    <StoryStack>
      <StoryNote>
        제품 규칙: 게임 리소스 = gold, 섀소식 내부 서비스 링크와 외부 = aqua.
        아래 첫 줄이 목표, 둘째 줄이 현장에서 흔한 대체물이다.
      </StoryNote>
      <div className="space-y-4 font-service">
        <div>
          <StoryHeading>목표</StoryHeading>
          <p>
            <a className="spire-gold font-semibold underline decoration-yellow-500/30" href="#card">
              충격파
            </a>
            {" · "}
            <a className="spire-aqua font-semibold" href="#byrdispatch">
              조각모음
            </a>
            {" · "}
            <a className="spire-aqua font-semibold" href="https://youtube.com">
              YouTube
            </a>
          </p>
        </div>
        <div>
          <StoryHeading>현장에서 흔함 (맞출 것)</StoryHeading>
          <p>
            <a className="text-yellow-500 hover:text-yellow-400" href="#feed">
              yellow-500 피드 링크
            </a>
            {" · "}
            <a className="text-cyan-200 hover:text-cyan-100" href="#news">
              cyan-200 섀소식
            </a>
          </p>
        </div>
      </div>
    </StoryStack>
  ),
};
