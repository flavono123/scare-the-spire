"use client";

import { useState } from "react";
import { SearchBar } from "@/components/codex/search-bar";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { DonatedRunsSection } from "./donated-runs-section";
import { MyRunsList } from "./my-runs-list";
import { ProdRunsDevSection } from "./prod-runs-dev-section";
import { RunUploadZone } from "./run-upload-zone";
import { UploadTutorial } from "./upload-tutorial";

// Client-side composition: drop zone + tutorial sit full-width on top;
// 내 런 and 공유된 런 sit side-by-side at lg+ widths (each as a 2-col
// card grid). A refreshKey bump on a successful upload re-hydrates
// both lists so freshly-saved runs surface on both sides without
// requiring a page reload.
export function HistoryCourseLanding() {
  const copy = serviceMessages[useServiceLocale()].historyCourse.lists;
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const bump = () => setRefreshKey((k) => k + 1);
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <RunUploadZone onUploadComplete={bump} />
        <UploadTutorial />
      </div>
      <div className="max-w-xl">
        <SearchBar
          value={query}
          onChange={setQuery}
          inputId="history-course-run-search"
          placeholder={copy.searchPlaceholder}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <MyRunsList refreshKey={refreshKey} query={query} />
        <DonatedRunsSection refreshKey={refreshKey} query={query} />
      </div>
      <ProdRunsDevSection />
    </div>
  );
}
