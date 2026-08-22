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
        DESIGN.md가 정본이다. 아래는 라이트모드 전에 남는 것.
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
            "페이지 배경",
            "의미 토큰 한 벌",
            "ServiceBackground hex, theme-color, --background가 제각각",
          ],
          [
            "이야기 좋아요",
            "강령의 극 하나",
            "운영 감정 팔레트가 깨지지 않게 보류",
          ],
        ]}
      />
      <StoryHeading>이번에 맞춘 것</StoryHeading>
      <CompareTable
        headers={["층", "상태"]}
        rows={[
          ["골드", "TEXT_GOLD #EFC851 = spire-gold = --primary"],
          ["링크", "리소스 gold, 섀소식·외부 TEXT_AQUA. cyan 링크 제거"],
          ["이름", "호출부 CompendiumIndexLayout / RelatedResourceLinks"],
          ["검색 라벨", "인챈트"],
          ["백과사전 좋아요 스킨", "타일 오버레이 강령의 극 + TEXT_GOLD"],
        ]}
      />
    </StoryStack>
  ),
};
