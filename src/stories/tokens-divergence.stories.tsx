import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CompareTable, StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "토큰/문서와 구현",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Divergence: Story = {
  name: "남은 어긋남",
  render: () => (
    <StoryStack>
      <StoryNote>
        DESIGN.md가 정본이다. 아래는 아직 코드가 문서를 못 따라간 것.
      </StoryNote>
      <CompareTable
        headers={["항목", "정본", "아직"]}
        rows={[
          [
            "토큰 방향",
            ":root = 다크, color-scheme: dark",
            "html.dark 클래스는 레이아웃에 남아 있음. 값은 :root와 같음",
          ],
          [
            "yellow-500 / 옛 #d4a843",
            "강조는 TEXT_GOLD",
            "피드·필터·보더 유틸에 yellow-500이 많이 남음. 넓으면 별도 패스",
          ],
          [
            "링크",
            "게임 리소스 gold, 섀소식·외부 aqua",
            "cyan-200, yellow-500 hover가 섞임. 토큰 잔여 정리 후",
          ],
          [
            "페이지 배경",
            "의미 토큰 한 벌",
            "ServiceBackground hex, theme-color, --background가 제각각",
          ],
          [
            "컴포넌트 이름",
            "CompendiumIndexLayout, RelatedResourceLinks",
            "호출부는 아직 Codex* / EntityReference*",
          ],
          [
            "검색 라벨",
            "인챈트",
            "통합검색은 마법부여",
          ],
        ]}
      />
      <StoryHeading>이번에 맞춘 것</StoryHeading>
      <CompareTable
        headers={["층", "상태"]}
        rows={[
          ["골드", "TEXT_GOLD #EFC851 = spire-gold = --primary (다크)"],
          ["[green]/[red]", "StsColors. 캐릭터 spire-green/red와 분리"],
          ["폰트", "font-service / font-game-title / font-game-text"],
          ["막 파랑", "spire-blue #60a5fa. 게임 본문 [blue]와 다름"],
          ["버프·너프 모션", "sine / jitter"],
        ]}
      />
    </StoryStack>
  ),
};
