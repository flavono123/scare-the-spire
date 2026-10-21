import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";
import {
  EXTERNAL_PROSE_LINK_CLASS,
  INTERNAL_PROSE_LINK_CLASS,
  RESOURCE_LINK_CLASS,
} from "@/lib/service-link-classes";

const meta = {
  title: "컴포넌트/링크",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Roles: Story = {
  name: "역할별 색",
  render: () => (
    <StoryStack>
      <StoryNote>
        게임 리소스 = gold (`spire-gold` / TEXT_GOLD). 사이트 내부 = aqua
        (`--link-internal`), 외부 = blue (`--link-external`). 뷰어와 에디터가
        같은 변수를 쓴다. Tailwind `cyan-*`와 디펙트 `spire-aqua`는 링크 색이 아니다.
      </StoryNote>
      <div className="space-y-4 font-service">
        <div>
          <StoryHeading>게임 리소스</StoryHeading>
          <p>
            <a className={RESOURCE_LINK_CLASS} href="#card">
              충격파
            </a>
          </p>
        </div>
        <div>
          <StoryHeading>사이트 내부 · 외부</StoryHeading>
          <p>
            <a className={INTERNAL_PROSE_LINK_CLASS} href="#byrdispatch">
              조각모음
            </a>
            {" · "}
            <a className={EXTERNAL_PROSE_LINK_CLASS} href="https://youtube.com">
              YouTube
            </a>
          </p>
        </div>
      </div>
    </StoryStack>
  ),
};
