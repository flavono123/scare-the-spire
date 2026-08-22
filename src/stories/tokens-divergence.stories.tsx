import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CompareTable, StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "토큰/문서와 구현",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Divergence: Story = {
  name: "어긋남 목록",
  render: () => (
    <StoryStack>
      <StoryNote>
        라이트모드 전에 다크에서 맞출 것. 정본을 고르는 기준: 게임 추출값은
        게임 층, 서비스 역할(강조/링크/배경)은 코드+제품 규칙, DESIGN.md는
        그 둘을 따라 고친다.
      </StoryNote>
      <CompareTable
        headers={["항목", "DESIGN.md", "구현", "제안 정본"]}
        rows={[
          [
            "기본 강조",
            "#eab308 yellow-500",
            "spire-gold #d4a843 와 yellow-500 공존. --primary는 흰 회색",
            "서비스 강조 = spire-gold. --primary도 그쪽으로. yellow-500은 희귀도 등 예외만",
          ],
          [
            "게임 크롬 골드",
            "없음 (yellow-500으로 뭉뚱그림)",
            "hover tip / GameUiHoverTip #EFC851",
            "게임 애셋 글자색. 스킴에 묶지 않음",
          ],
          [
            "링크",
            "게임 요소는 gold. aqua 규칙 없음",
            "YouTube = spire-aqua. 섀소식 = text-cyan-200. 내비/피드 = yellow-500 hover",
            "link-game = gold. 섀소식 내부 서비스 + 외부 = aqua. cyan-* 제거",
          ],
          [
            "페이지 배경",
            "#0f0f13 / bg-background",
            "--background oklch(0.141). ServiceBackground #07070d/#080810. theme-color #1a1a2e",
            "캔버스/패널/스크림을 의미 토큰 한 벌. DESIGN 표를 그 값으로 수정",
          ],
          [
            "패널",
            "#16162a",
            "백과사전 셸 bg-[#16162a] — 여기만 문서와 같음. 장난감 상자 카드는 bg-card/30",
            "패널 토큰. 셸은 이미 가깝다",
          ],
          [
            "토큰 방향",
            "다크 전용",
            ":root = shadcn 라이트, html.dark 강제",
            ":root를 다크 정본으로 뒤집기 (라이트는 그 다음)",
          ],
          [
            "컴포넌트 이름",
            "CompendiumIndexLayout, RelatedResourceLinks",
            "CodexLibraryShell, EntityReferenceLinks. 지금은 alias만 추가",
            "호출부를 점진적으로 DESIGN 이름으로",
          ],
          [
            "검색 라벨",
            "인챈트 (게임 용어)",
            "백과사전 카피는 인챈트, 통합검색은 마법부여",
            "게임 번역 인챈트로 통일. 검색 라벨은 별도 결정 필요",
          ],
        ]}
      />
      <StoryHeading>이미 맞는 층</StoryHeading>
      <CompareTable
        headers={["층", "상태"]}
        rows={[
          ["폰트 토큰", "font-service / font-game-title / font-game-text"],
          ["캐릭터 원색", "CHARACTER_COLORS = spire-* hex"],
          ["막 파랑", "spire-blue / #60a5fa. 막을 캐릭터색으로 안 칠함"],
          ["버프·너프 효과", "green+sine / red+jitter. 게임 텍스트 효과"],
        ]}
      />
    </StoryStack>
  ),
};
