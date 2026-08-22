import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CompendiumIndexLayout,
  CompendiumIndexTopBar,
} from "@/components/codex/codex-filter-drawer";
import { SearchBar } from "@/components/codex/search-bar";
import { StoryNote, StoryStack } from "./_ui";

const meta = {
  title: "컴포넌트/백과사전 셸",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Layout: Story = {
  name: "CompendiumIndexLayout (alias of CodexLibraryShell)",
  render: function ShellStory() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    return (
      <StoryStack>
        <StoryNote>
          DESIGN.md 이름. 구현 심볼은 아직 CodexLibrary*. 필터 드로어
          bg-[#16162a]는 문서 패널값과 같다. 제목은 text-primary (TEXT_GOLD).
        </StoryNote>
        <CompendiumIndexLayout
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isMobile={false}
          sidebar={
            <p className="font-service text-xs text-muted-foreground">필터</p>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <CompendiumIndexTopBar
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              closeFiltersLabel="필터 닫기"
              openFiltersLabel="필터 열기"
              title="카드"
              count="612"
              trailing={<div className="w-48"><SearchBar value="" onChange={() => undefined} /></div>}
            />
            <div className="flex-1 p-4 font-service text-sm text-muted-foreground">
              목록 본문
            </div>
          </div>
        </CompendiumIndexLayout>
      </StoryStack>
    );
  },
};

export const Search: Story = {
  name: "SearchBar — 게임식 인셋 검색",
  parameters: { layout: "padded" },
  render: function SearchStory() {
    const [value, setValue] = useState("");
    return (
      <div className="max-w-sm">
        <SearchBar value={value} onChange={setValue} placeholder="검색" />
      </div>
    );
  },
};
