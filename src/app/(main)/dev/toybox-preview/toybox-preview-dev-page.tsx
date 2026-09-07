"use client";

import { useEffect, useState } from "react";
import { DefragmentBoardFixture } from "@/components/dev/defragment-board-fixture";
import { DevViewportFrame } from "@/components/dev/dev-viewport-frame";
import { fetchDefragmentFeedPage } from "@/lib/defragment-feed";
import {
  TOYBOX_PREVIEW_MOBILE_VIEWPORT,
  TOYBOX_PREVIEW_PC_VIEWPORT,
  TOYBOX_PREVIEW_SURFACES,
  type ToyBoxPreviewSample,
  type ToyBoxPreviewServiceId,
} from "@/lib/dev-toybox-preview";
import {
  DEFAULT_TOYBOX_FEED_SORT,
  TOYBOX_FEED_SERVICES,
  TOYBOX_FEED_TABLES,
  fetchToyboxFeedPage,
} from "@/lib/toybox-feed";
import Image from "@/components/ui/static-image";

type SampleMap = Partial<Record<ToyBoxPreviewServiceId, ToyBoxPreviewSample>>;

function useToyboxPreviewSamples() {
  const [samples, setSamples] = useState<SampleMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next: SampleMap = {};

      try {
        const page = await fetchDefragmentFeedPage({
          sort: DEFAULT_TOYBOX_FEED_SORT,
          cursor: null,
        });
        const first = page.items[0];
        if (first) {
          next.defragment = { id: first.id, federatedService: first.service };
        }
      } catch {
        // Lab still renders index iframes when the feed is empty.
      }

      await Promise.all(TOYBOX_FEED_SERVICES.map(async (service) => {
        try {
          const page = await fetchToyboxFeedPage({
            service,
            table: TOYBOX_FEED_TABLES[service],
            sort: DEFAULT_TOYBOX_FEED_SORT,
            cursor: null,
            normalizePost: (raw) => {
              const row = raw as { id?: unknown; created_at?: unknown };
              return {
                id: typeof row.id === "string" ? row.id : "",
                created_at: typeof row.created_at === "string" ? row.created_at : "",
              };
            },
          });
          const id = page.items[0]?.post.id;
          if (id) next[service] = { id };
        } catch {
          // Skip missing sample for this service.
        }
      }));

      try {
        const response = await fetch("/api/dev/history-course-runs");
        if (response.ok) {
          const body = await response.json() as { runs?: Array<{ id?: unknown }> };
          const id = body.runs?.[0]?.id;
          if (typeof id === "string" && id.length > 0) {
            next.history_course = { id };
          }
        }
      } catch {
        // History Course sample is optional.
      }

      if (!cancelled) {
        setSamples(next);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { samples, loading };
}

export default function ToyBoxPreviewDevPage() {
  const { samples, loading } = useToyboxPreviewSamples();

  return (
    <main
      data-dev-toybox-preview
      className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-4 py-6 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          DEV / TOY BOX PREVIEW
        </p>
        <h1 className="text-3xl font-bold text-zinc-100">장난감 상자 미리보기</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          인덱스와 상세를 PC(1280) / 모바일(390, iPhone 6.1) iframe으로 나란히 본다.
          주소는 로컬 실제 페이지이고, 글은 연결된 피드의 최신 한 건이다.
          조각모음 게시판은 컨테이너 쿼리로 좁은 폭에서 제목을 두 줄까지 남기고
          작성자·날짜를 아래로 내린다. Reddit compact / 아카라이브 모바일 목록과 같이
          제목·댓글·추천을 남기고 메타는 2행으로 줄인다.
        </p>
      </header>

      <section className="flex flex-col gap-3" data-dev-toybox-preview-fixture>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-100">조각모음 긴 제목 픽스처</h2>
          <p className="text-xs text-zinc-500">
            피드 제목 길이와 무관하게 모바일 2줄 클램프를 보기 위한 목 데이터.
            왼쪽은 넓은 보드(컬럼), 오른쪽은 390px 컨테이너(스택).
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex w-[40rem] max-w-full shrink-0 flex-col gap-2">
            <p className="text-xs font-semibold text-zinc-200">넓은 보드 (≥576px)</p>
            <DefragmentBoardFixture widthClass="w-full" />
          </div>
          <div className="flex w-[390px] max-w-full shrink-0 flex-col gap-2">
            <p className="text-xs font-semibold text-zinc-200">좁은 보드 (390px)</p>
            <DefragmentBoardFixture widthClass="w-full" />
          </div>
        </div>
      </section>

      {TOYBOX_PREVIEW_SURFACES.map((surface) => {
        const sample = samples[surface.id] ?? null;
        const detailHref = sample ? surface.detailHref(sample) : null;
        return (
          <section
            key={surface.id}
            data-dev-toybox-preview-service={surface.id}
            className="flex flex-col gap-4 border-t border-white/10 pt-8"
          >
            <div className="flex items-center gap-3">
              <Image
                src={surface.tokenSrc}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-zinc-100">{surface.label}</h2>
                <p className="font-mono text-[11px] text-zinc-500">
                  {surface.indexHref}
                  {detailHref ? ` · ${detailHref}` : loading ? " · 상세 샘플 불러오는 중" : " · 상세 샘플 없음"}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-300">인덱스</h3>
                <div className="flex flex-wrap items-start gap-6">
                  <DevViewportFrame
                    label="PC"
                    src={surface.indexHref}
                    width={TOYBOX_PREVIEW_PC_VIEWPORT.width}
                    height={TOYBOX_PREVIEW_PC_VIEWPORT.height}
                    maxDisplayWidth={560}
                  />
                  <DevViewportFrame
                    label="모바일"
                    src={surface.indexHref}
                    width={TOYBOX_PREVIEW_MOBILE_VIEWPORT.width}
                    height={TOYBOX_PREVIEW_MOBILE_VIEWPORT.height}
                    maxDisplayWidth={390}
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-300">상세</h3>
                <div className="flex flex-wrap items-start gap-6">
                  <DevViewportFrame
                    label="PC"
                    src={detailHref}
                    width={TOYBOX_PREVIEW_PC_VIEWPORT.width}
                    height={TOYBOX_PREVIEW_PC_VIEWPORT.height}
                    maxDisplayWidth={560}
                  />
                  <DevViewportFrame
                    label="모바일"
                    src={detailHref}
                    width={TOYBOX_PREVIEW_MOBILE_VIEWPORT.width}
                    height={TOYBOX_PREVIEW_MOBILE_VIEWPORT.height}
                    maxDisplayWidth={390}
                  />
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
