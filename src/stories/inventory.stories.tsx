import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CompareTable, StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "재고/합칠 지점",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Inventory: Story = {
  render: () => (
    <StoryStack gap={24}>
      <StoryNote>
        DESIGN.md 「아직 손대지 않는 것들」과 같다. 합치라는 지시가 아니라
        겉보기만 비슷한 목록이다.
      </StoryNote>

      <StoryHeading>이번에 한 일</StoryHeading>
      <CompareTable
        headers={["것", "결정"]}
        rows={[
          ["골드", "TEXT_GOLD 하나. yellow-500 / 옛 #d4a843은 잔여 정리"],
          ["호버 팁", "둘 유지. 9-slice 상수만 공유"],
          ["이야기 감정 팔레트", "강령의 극 LikeButton. reaction_type 컬럼은 나중에"],
          ["댓글·프로필 좋아요 아이콘", "같은 SpireLikeIcon"],
          ["STS1 Badge", "deprecated. 새 UI에 안 씀"],
        ]}
      />

      <StoryHeading>보이는 건 같은데 속이 다른 것</StoryHeading>
      <CompareTable
        headers={["무엇", "왜 그대로 두나"]}
        rows={[
          [
            "장난감 상자 글 카드 4종",
            "가운데 그림이 다름. 껍데기만 나중에 묶을 수 있음",
          ],
          [
            "이거아님저거 아랫줄",
            "좋아요 옆에 투표가 있음. 테이블도 아직 별도",
          ],
          [
            "리소스 고르는 창 3종",
            "고르는 규칙이 다름 (여러 장 / 타입 제한 / 한쪽 칸)",
          ],
          [
            "GameConfirmModal",
            "게임에서 뽑은 예/아니오. 글쓰기 패널이 아님",
          ],
        ]}
      />

      <StoryHeading>복붙·레거시</StoryHeading>
      <CompareTable
        headers={["무엇", "메모"]}
        rows={[
          ["백과사전 딤 오버레이", "여러 파일이 같은 어두운 막을 복사"],
          ["이야기 쓰기 창", "ServiceModalFrame 후보"],
          ["케미컬X 작성", "목록 인라인. 창이 없는 게 제품"],
          ["STS1 브라우저 / CharacterBadge", "옛 사이트. 합치지 않음"],
          ["통합검색 마법부여", "백과사전은 인챈트"],
          ["Composer 제목 색", "yellow-100 vs gold 잔여"],
        ]}
      />
    </StoryStack>
  ),
};
