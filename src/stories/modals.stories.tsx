import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ServiceModalFrame } from "@/components/service-modal-frame";
import { StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "컴포넌트/모달 프레임",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ComposerChrome: Story = {
  name: "ServiceModalFrame — Combo/변형/이거아님저거 셸",
  render: function ModalStory() {
    const [open, setOpen] = useState(true);
    return (
      <StoryStack>
        <StoryNote>
          오버레이, Escape, 스크롤 잠금, 헤더+닫기를 한 프레임으로 올렸다.
          패널 폭(좁은 코옴보 vs 넓은 변형)과 제목색은 className 확장.
          이야기 작성 모달·패치 스토리 시트·GameConfirmModal은 아직 바깥.
        </StoryNote>
        <button
          type="button"
          className="w-fit rounded border border-border px-3 py-1.5 font-service text-sm"
          onClick={() => setOpen(true)}
        >
          프레임 열기
        </button>
        {open ? (
          <ServiceModalFrame
            title="결합이다!"
            titleId="storybook-composer"
            closeLabel="닫기"
            onClose={() => setOpen(false)}
            showAccentDot
            titleClassName="text-yellow-100"
            panelClassName="relative sm:max-w-lg"
            overlayClassName="!absolute min-h-[24rem]"
          >
            <p className="font-service text-sm text-muted-foreground">
              에디터 슬롯. 서비스별 본문은 여기에만 갈린다.
            </p>
          </ServiceModalFrame>
        ) : null}
      </StoryStack>
    );
  },
};
