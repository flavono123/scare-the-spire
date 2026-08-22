import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LikeControl } from "@/components/like-control";
import { OwnPostMark } from "@/components/own-post-mark";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { StoryHeading, StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "컴포넌트/참여",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Like: Story = {
  name: "LikeControl — 끌어올린 크롬",
  render: function LikeStory() {
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(3);
    return (
      <StoryStack>
        <StoryNote>
          이야기·장난감 상자·백과사전 좋아요는 강령의 극. 이거아님저거는
          같은 버튼이고 테이블만 아직 갈라져 있다. 투표 엄지는 좋아요가 아니다.
        </StoryNote>
        <LikeControl
          count={count}
          liked={liked}
          lift
          tipLabel="추천"
          tipLabelActive="추천 취소"
          onToggle={(event) => {
            event.preventDefault();
            setLiked((value) => !value);
            setCount((value) => (liked ? value - 1 : value + 1));
          }}
        />
        <LikeControl
          count={12}
          liked={false}
          pending
          alwaysShowCount
          onToggle={() => undefined}
        />
        <LikeControl
          count={0}
          liked={false}
          blocked
          alwaysShowCount
          onToggle={() => undefined}
        />
      </StoryStack>
    );
  },
};

export const IndexEngagement: Story = {
  name: "IndexCardEngagement — 댓글+추천 묶음",
  render: () => (
    <StoryStack>
      <StoryNote>
        Combo / Chemical X / Transfigure 인덱스 카드가 이걸 쓴다.
        이거아님저거는 투표 줄 때문에 카드 안에서 댓글 링크를 다시 그린다.
      </StoryNote>
      <IndexCardEngagement
        commentsHref="#comments"
        commentCount={4}
        likeStoryId="storybook-like"
        likeCount={2}
        userId={null}
        authReady={false}
      />
    </StoryStack>
  ),
};

export const Ownership: Story = {
  name: "OwnPostMark",
  render: () => (
    <StoryStack>
      <StoryHeading>내 글 표시</StoryHeading>
      <p className="flex items-center gap-2 font-service text-sm text-zinc-300">
        닉네임 <OwnPostMark />
      </p>
    </StoryStack>
  ),
};
