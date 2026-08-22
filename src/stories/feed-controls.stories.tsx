import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FeedSortToggle } from "@/components/feed-sort-toggle";
import { Badge } from "@/components/ui/badge";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "컴포넌트/피드 컨트롤",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Sort: Story = {
  name: "FeedSortToggle — 장난감 상자 공통",
  render: function SortStory() {
    const [sort, setSort] = useState<ToyboxFeedSort>("latest");
    return (
      <StoryStack>
        <StoryNote>
          최신 / 추천 / 댓글. Stories 피드도 같은 버튼 순서. shadcn Toggle과는
          별개 — Toggle/ToggleGroup은 거의 안 쓴다.
        </StoryNote>
        <FeedSortToggle
          sort={sort}
          onSortChange={setSort}
          labels={{
            latest: "최신",
            recommended: "추천",
            comments: "댓글",
            vote_rate_high: "득표↑",
            vote_rate_low: "득표↓",
          }}
        />
      </StoryStack>
    );
  },
};

export const ShadcnBadge: Story = {
  name: "shadcn Badge — 거의 안 씀 (STS1 CharacterBadge)",
  render: () => (
    <StoryStack>
      <StoryHeading>프리미티브 vs 제품</StoryHeading>
      <StoryNote>
        Badge default는 이제 gold fill이다. CharacterBadge는 STS1 유물/포션만.
        deprecated. 새 화면에 쓰지 않는다.
      </StoryNote>
      <div className="flex flex-wrap gap-2">
        <Badge>default primary</Badge>
        <Badge variant="outline">outline</Badge>
        <Badge variant="secondary">secondary</Badge>
      </div>
    </StoryStack>
  ),
};
