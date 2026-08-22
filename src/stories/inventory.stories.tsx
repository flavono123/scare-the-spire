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
        이번 워크숍에서 실제로 끌어올린 것과, 확장이 아니라 분기여서 나란히
        남겨 둔 것, 복붙·지엽이라 다음에 줄일 것.
      </StoryNote>

      <StoryHeading>이번에 합침</StoryHeading>
      <CompareTable
        headers={["끌어올림", "이전", "형태"]}
        rows={[
          ["formatTimeAgo", "5파일 로컬 timeAgo", "확장 아님, 완전 복붙"],
          ["LikeControl", "LikeButton + ThisOrThatLikeButton 크롬", "데이터 훅은 분기로 남김"],
          ["ServiceModalFrame", "Combo / 변형 / 이거아님저거 오버레이", "폭·제목색은 className 확장"],
          ["compendiumTypeLabels", "피커 4곳의 codex 라벨 맵", "완전 복붙"],
          ["CompendiumIndexLayout alias", "DESIGN 이름 vs CodexLibraryShell", "이름만. 호출부는 아직 Codex*"],
        ]}
      />

      <StoryHeading>같은 의도, 아직 분기 (합치면 안 되는 이유 있음)</StoryHeading>
      <CompareTable
        headers={["겉보기", "왜 분기인가", "다음에"]}
        rows={[
          [
            "인덱스 카드 4종",
            "본문 슬롯이 다름 (스택/투표/변형 프리뷰). 셸 클래스도 hover gold가 제각각",
            "카드 셸(닉·시간·참여)만 ToyBoxIndexCard로 확장 가능. 본문은 children",
          ],
          [
            "This or That 참여 줄",
            "투표 UI + 자체 likes 테이블. IndexCardEngagement를 못 씀",
            "댓글 링크 조각만 공유",
          ],
          [
            "리소스 피커 3종",
            "변형은 타입 제한, 코옴보는 멀티셀렉트, 이거아님저거는 한쪽 패널",
            "검색+타입칩+결과행은 공유 가능. 선택 모델은 분기",
          ],
          [
            "GameHoverTip vs GameUiHoverTip",
            "인라인 본문 vs 포탈 한 줄. 슬라이스 숫자는 복붙",
            "9-slice 상수 공유, 셸은 둘 또는 슬롯 하나",
          ],
          [
            "GameConfirmModal",
            "추출한 게임 팝업. 서비스 모달 프레임과 층이 다름",
            "합치지 않음 — 게임 크롬",
          ],
        ]}
      />

      <StoryHeading>복붙 / 지엽 — 줄일 지점</StoryHeading>
      <CompareTable
        headers={["것", "위치", "제안"]}
        rows={[
          [
            "bg-black/70 backdrop-blur 오버레이",
            "백과사전 라이브러리 모달 12곳, STS1 브라우저 3곳, HC 시트",
            "상세 보기 딤은 ResourceDetailView 공용 스크림. 지금은 각 라이브러리가 복붙",
          ],
          [
            "이야기 작성 모달",
            "story-composer-modal, patch-note-with-story-actions, story-feed 시트",
            "ServiceModalFrame 후보. 패치 라인 검색 본문만 다름",
          ],
          [
            "케미컬X 작성",
            "전용 모달 없음. 인덱스에 에디터가 열려 있음",
            "모달로 맞출지 말지는 제품 결정. 지금은 지엽",
          ],
          [
            "CharacterBadge / CHARACTER_RING",
            "STS1 유물·포션만. Defect=blue, Watcher=purple",
            "STS2와 합치지 않음. 레거시 섬",
          ],
          [
            "shadcn Badge/Tabs/Toggle",
            "ui/ 5파일. ToggleGroup은 거의 미사용",
            "새 컨트롤에 쓰지 말 것. FeedSortToggle / 게임 탭을 씀",
          ],
          [
            "card-browser / relic-browser / potion-browser",
            "STS1 레거시",
            "백과사전 셸과 합치지 않음",
          ],
          [
            "통합검색 마법부여 vs 백과사전 인챈트",
            "messages/service.ts",
            "라벨 토큰 한곳. 게임 번역 우선이면 인챈트",
          ],
          [
            "Composer 제목 yellow-100 vs spire-gold",
            "Combo vs 변형, 방금 프레임으로 합친 뒤에도 className으로 갈림",
            "둘 다 spire-gold로 확장 수렴",
          ],
          [
            "/dev/text-effects, /dev/spire-icons",
            "사이트 안 레퍼런스 페이지",
            "토큰·아이콘 스토리가 대체. 페이지는 개발 도구로 남기거나 링크만",
          ],
        ]}
      />
    </StoryStack>
  ),
};
