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
          LikeButton(훅+likes 테이블)과 ThisOrThatLikeButton(제어 컴포넌트,
          별도 테이블)은 데이터 층이 달라 분기다. 보이는 버튼은 LikeControl로
          합쳤다.
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
        This or That는 투표 때문에 댓글 링크를 카드 안에 다시 그렸다 — 분기.
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
