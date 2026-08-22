import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";
import {
  RESOURCE_LINK_CLASS,
  SERVICE_ACCENT_CLASS,
  SERVICE_LINK_CLASS,
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
        게임 리소스 = gold (`spire-gold` / TEXT_GOLD). 섀소식·외부 = aqua
        (`sts-text-aqua` / TEXT_AQUA). Tailwind `cyan-*`와 디펙트 `spire-aqua`는
        링크 색이 아니다.
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
          <StoryHeading>섀소식 · 외부</StoryHeading>
          <p>
            <a className={`${SERVICE_ACCENT_CLASS} font-semibold`} href="#byrdispatch">
              조각모음
            </a>
            {" · "}
            <a className={SERVICE_LINK_CLASS} href="https://youtube.com">
              YouTube
            </a>
          </p>
        </div>
      </div>
    </StoryStack>
  ),
};
