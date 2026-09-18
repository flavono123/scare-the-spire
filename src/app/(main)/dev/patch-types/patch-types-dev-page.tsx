import Link from "next/link";
import Image from "@/components/ui/static-image";
import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/rich-text";
import {
  PatchBalanceChip,
  PatchTypeChip,
  PATCH_TYPE_TOKENS,
  PATCH_BALANCE_TOKEN,
} from "@/components/patches/patch-chips";
import { PatchDraftChip, PATCH_DRAFT_TOKEN } from "@/components/patches/patch-draft-chrome";
import { BackstabTransfigureSection } from "@/components/patches/backstab-transfigure-section";
import { PatchArtPreview } from "@/components/patches/patch-art";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getPatchBackstabGameCopy, getPatchStageGameCopy } from "@/lib/borrowed-game-copy";
import { getRecentTransfigurePosts } from "@/lib/transfigure-data";
import { getSTS2Patches } from "@/lib/data";
import { resolvePatchArt } from "@/lib/sts2-patch-art";
import { TEXT_GREEN } from "@/lib/sts2-card-style";
import type { PatchType } from "@/lib/types";

const PATCH_TYPES: readonly {
  type: PatchType;
  labelKo: string;
  labelEn: string;
  desc: string;
}[] = [
  {
    type: "release",
    labelKo: "출시",
    labelEn: "Release",
    desc: "정식 릴리즈 및 대규모 버전 런칭 패치 (창세 토큰)",
  },
  {
    type: "beta",
    labelKo: "베타",
    labelEn: "Beta",
    desc: "밸런스 개편 및 기능이 포함된 베타 패치 (엔트로피 토큰)",
  },
  {
    type: "stable",
    labelKo: "안정",
    labelEn: "Stable",
    desc: "정규 안정화 빌드 패치 (인공물 토큰)",
  },
  {
    type: "hotfix",
    labelKo: "핫픽스",
    labelEn: "Hotfix",
    desc: "긴급 버그 수정 및 당일 픽스 패치 (핫픽스 토큰)",
  },
  {
    type: "backstab",
    labelKo: "배신",
    labelEn: "Backstab",
    desc: "스팀 패치 지연 및 만우절/특수 이벤트 패치 (약화 토큰 + jitter 애니메이션)",
  },
];

const VISUAL_STAGES = [
  {
    id: "prep_time",
    name: "준비 시간 (Prep Time)",
    status: "watching",
    tokenSrc: "/images/sts2/intents/animated/sleep.webp",
    tokenAlt: "수면",
    borderClass: "border-amber-500/30 bg-amber-950/10",
    textClass: "text-amber-200/80",
    desc: "오늘의 패치가 드러나기를 기다리고 있습니다...",
  },
  {
    id: "delay",
    name: "지연 (Delay)",
    status: "watching",
    tokenSrc: "/images/sts2/intents/animated/unknown.webp",
    tokenAlt: "미지",
    borderClass: "border-zinc-800 bg-zinc-950/35",
    textClass: "text-zinc-500",
    desc: "이 패치에 관한 정보는 아직 드러나지 않았습니다...",
  },
  {
    id: "building",
    name: "작업 도구 (Building)",
    status: "building",
    tokenSrc: "/images/sts2/powers/animated/tools_of_the_trade_power_tilt.webp",
    tokenAlt: "작업 도구",
    borderClass: "border-zinc-800 bg-zinc-950/35",
    textClass: "text-zinc-500",
    desc: "Steam 패치는 공개됐고, rich 패치노트를 게시 준비 중인 상태",
  },
  {
    id: "ready",
    name: "패치노트 게시 (Ready)",
    status: "ready",
    tokenSrc: "/images/sts2/nav/patch_notes_icon.png",
    tokenAlt: "패치 노트",
    borderClass: "border-border bg-card/50",
    textClass: "text-foreground",
    desc: "번역·링크·호버 팁 검수가 완료된 정규 rich 패치노트",
  },
  {
    id: "backstab_upgraded",
    name: "배신+ (Backstab+)",
    status: "backstab",
    tokenSrc: "/images/sts2/relics/silver_crucible.webp",
    tokenAlt: "은 도가니",
    borderClass: "border-rose-500/30 bg-rose-950/15 shadow-[0_0_24px_rgba(244,63,94,0.08)]",
    textClass: "text-[#7FFF00]",
    desc: "3번의 패치가 [gold]베타[/gold] 상태로 등장합니다. 다음으로 여는 큰 패치가 [red]비어 있습니다[/red].",
  },
];

export default async function PatchesDevPage() {
  const [entities, patchStageCopy, patchBackstabCopy, initialTransfigures, patches] = await Promise.all([
    loadAllEntities({ gameLocale: "kor" }),
    getPatchStageGameCopy("kor"),
    getPatchBackstabGameCopy("kor"),
    getRecentTransfigurePosts(15),
    getSTS2Patches(),
  ]);
  const entityMap = new Map(entities.map((e) => [`${e.type}:${e.id}`, e]));

  const backstabPatch = patches.find((p) => p.version === "2026-09-11" || p.id === "2026-09-11") ?? {
    id: "2026-09-11",
    version: "2026-09-11",
    type: "backstab" as const,
    date: "2026-09-11",
    hasBalanceChanges: false,
    title: "배신+",
    art: { type: "card" as const, id: "BACKSTAB" },
  };
  const patch111 = patches.find((p) => p.version === "0.111.0") ?? patches[0];
  const patch100 = patches.find((p) => p.version === "0.100.0") ?? patches[patches.length - 1];
  const patch112 = patches.find((p) => p.version === "0.112.0") ?? patches[0];

  const backstabArt = resolvePatchArt(backstabPatch, entityMap, "ko");
  const art111 = resolvePatchArt(patch111, entityMap, "ko");
  const art100 = resolvePatchArt(patch100, entityMap, "ko");
  const art112 = resolvePatchArt(patch112, entityMap, "ko");
  const artWatch = resolvePatchArt(patches[0], entityMap, "ko");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-12">
      {/* DEV Header */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
            DEV ONLY
          </span>
          <span className="text-xs text-muted-foreground">
            개발 환경 전용 패치노트 카탈로그
          </span>
        </div>
        <h1 className="font-game-title text-3xl font-bold tracking-wide text-foreground">
          패치노트 카탈로그 &amp; 전 타입 쇼케이스
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          모든 패치 타입(PatchType), 시각적 단계(Visual Stage), 칩 뱃지, 상태별 목록 카드 및 배신+ 뷰를 검수합니다.
        </p>
      </div>

      {/* 1. 패치 타입 (PatchType) 카탈로그 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold text-foreground">1. 패치 종류 (PatchType) &amp; 칩 뱃지</h2>
          <span className="text-xs text-muted-foreground">5가지 PatchType 지원</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PATCH_TYPES.map(({ type, labelKo, labelEn, desc }) => {
            const token = PATCH_TYPE_TOKENS[type];
            return (
              <div
                key={type}
                className="rounded-lg border border-border bg-card/40 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image
                      src={token.src}
                      alt={token.alt.ko}
                      width={22}
                      height={22}
                      className="h-5.5 w-5.5 object-contain"
                    />
                    <span className="font-mono text-sm font-semibold uppercase">{type}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PatchTypeChip type={type} label={labelKo} serviceLocale="ko" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Muted:</span>
                  <PatchTypeChip type={type} label={labelKo} serviceLocale="ko" muted />
                  <span className="ml-auto font-mono text-[11px] text-zinc-400">{labelEn}</span>
                </div>
                <p className="text-xs text-muted-foreground/90">{desc}</p>
              </div>
            );
          })}

          {/* Balance chip showcase */}
          <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image
                  src={PATCH_BALANCE_TOKEN.src}
                  alt={PATCH_BALANCE_TOKEN.alt.ko}
                  width={22}
                  height={22}
                  className="h-5.5 w-5.5 object-contain"
                />
                <span className="font-mono text-sm font-semibold uppercase">balance</span>
              </div>
              <PatchBalanceChip label="밸런스" serviceLocale="ko" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Muted:</span>
              <PatchBalanceChip label="밸런스" serviceLocale="ko" muted />
              <span className="ml-auto font-mono text-[11px] text-zinc-400">Balance</span>
            </div>
            <p className="text-xs text-muted-foreground/90">
              카드/유물 등의 수치 변경이 포함된 패치 표시
            </p>
          </div>

          {/* Draft chip showcase */}
          <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image
                  src={PATCH_DRAFT_TOKEN.src}
                  alt={PATCH_DRAFT_TOKEN.alt.ko}
                  width={22}
                  height={22}
                  className="h-5.5 w-5.5 object-contain"
                />
                <span className="font-mono text-sm font-semibold uppercase">draft</span>
              </div>
              <PatchDraftChip
                title={patchStageCopy.draft.title}
                notice={patchStageCopy.draft.notice}
                serviceLocale="ko"
              />
            </div>
            <p className="text-xs text-muted-foreground/90">
              게시되었으나 아직 번역·링크 작업이 다듬어지는 중인 패치 (호버 시 툴팁 표시)
            </p>
          </div>
        </div>
      </section>

      {/* 2. 시각적 단계 (Visual Stage & Watch Stage) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold text-foreground">2. 패치 상태 및 시각 단계 (Visual Stages)</h2>
          <span className="text-xs text-muted-foreground">Watching &rarr; Building &rarr; Ready &amp; Backstab+</span>
        </div>

        <div className="space-y-3">
          {VISUAL_STAGES.map((stage) => (
            <div
              key={stage.id}
              className={`rounded-lg border p-4 ${stage.borderClass}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Image
                  src={stage.tokenSrc}
                  alt={stage.tokenAlt}
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
                <span
                  className={`text-base font-bold ${stage.textClass}`}
                  style={
                    stage.id === "backstab_upgraded"
                      ? {
                          color: TEXT_GREEN,
                          textShadow:
                            "-1px -1px 0 #1B6131, 1px -1px 0 #1B6131, -1px 1px 0 #1B6131, 1px 1px 0 #1B6131",
                        }
                      : undefined
                  }
                >
                  {stage.name}
                </span>
                <Badge variant="outline" className="ml-auto text-[11px] font-mono">
                  status: {stage.status}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <RichText text={stage.desc} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 실제 패치 목록 카드 실물 프리뷰 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold text-foreground">3. 패치 목록 카드 실물 프리뷰</h2>
          <span className="text-xs text-muted-foreground">실제 /patches 에 렌더링되는 카드 형태</span>
        </div>

        <div className="space-y-4">
          {/* Card 1: Backstab+ Card */}
          <div>
            <span className="text-xs font-semibold text-rose-300">
              ▼ 배신+ 카드 (은 도가니 토큰 + 강화 텍스트 + 은 도가니 패러디 히어로 문구)
            </span>
            <div className="mt-1.5 block rounded-lg border border-rose-500/30 bg-rose-950/15 p-4 shadow-[0_0_24px_rgba(244,63,94,0.08)]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Image
                    src="/images/sts2/relics/silver_crucible.webp"
                    alt="은 도가니"
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <span
                    className="font-game-title text-lg font-bold min-w-0"
                    style={{
                      color: TEXT_GREEN,
                      textShadow:
                        "-1px -1px 0 #1B6131, 1px -1px 0 #1B6131, -1px 1px 0 #1B6131, 1px 1px 0 #1B6131",
                    }}
                  >
                    배신+
                  </span>
                </span>
                <PatchTypeChip type="backstab" label="배신" serviceLocale="ko" />
              </div>
              <div className="mt-1 text-sm font-medium text-rose-100/90">
                <RichText text={patchBackstabCopy.hero} />
              </div>
              <p className="mt-0.5 text-xs text-rose-100/45">2026-09-11</p>
              {backstabArt && <PatchArtPreview art={backstabArt} />}
            </div>
          </div>

          {/* Card 2: Beta with balance changes */}
          <div>
            <span className="text-xs font-semibold text-blue-300">
              ▼ 정식 패치 카드 (베타 + 밸런스 칩)
            </span>
            <div className="mt-1.5 block rounded-lg border border-border bg-card/50 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Image
                    src="/images/sts2/nav/patch_notes_icon.png"
                    alt="패치 노트"
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <span className="text-lg font-semibold">v0.111.0</span>
                </span>
                <div className="inline-flex flex-wrap items-center gap-2">
                  <PatchTypeChip type="beta" label="베타" serviceLocale="ko" />
                  <PatchBalanceChip label="밸런스" serviceLocale="ko" />
                </div>
              </div>
              <p className="mt-1 text-sm font-medium">베타 패치 노트 - v0.111.0</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                싸움 준비·파괴광선 리워크, 고대의 존재 너프, 적 버프, 캐릭터 밸런스 등.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">2026-08-14</p>
              {art111 && <PatchArtPreview art={art111} />}
            </div>
          </div>

          {/* Card 3: Draft card */}
          <div>
            <span className="text-xs font-semibold text-amber-300">
              ▼ 작업 중(Draft) 패치 카드
            </span>
            <div className="mt-1.5 block rounded-lg border border-border bg-card/50 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Image
                    src="/images/sts2/nav/patch_notes_icon.png"
                    alt="패치 노트"
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <span className="text-lg font-semibold">v0.100.0</span>
                  <PatchDraftChip
                    title={patchStageCopy.draft.title}
                    notice={patchStageCopy.draft.notice}
                    serviceLocale="ko"
                  />
                </span>
                <div className="inline-flex flex-wrap items-center gap-2 border-l border-zinc-700/80 pl-3">
                  <PatchTypeChip type="beta" label="베타" serviceLocale="ko" />
                  <PatchBalanceChip label="밸런스" serviceLocale="ko" />
                </div>
              </div>
              <p className="mt-1 text-sm font-medium">베타 패치 노트 - v0.100.0</p>
              <p className="mt-0.5 text-xs text-muted-foreground">2026-04-10</p>
              {art100 && <PatchArtPreview art={art100} />}
            </div>
          </div>

          {/* Card 4: Building card */}
          <div>
            <span className="text-xs font-semibold text-zinc-400">
              ▼ 작업 도구 (Building) 상태 카드
            </span>
            <div className="mt-1.5 block rounded-lg border border-zinc-800 bg-zinc-950/35 p-4 shadow-inner">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-zinc-500">
                  <Image
                    src="/images/sts2/powers/animated/tools_of_the_trade_power_tilt.webp"
                    alt="작업 도구"
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <span>v0.112.0</span>
                </span>
                <PatchTypeChip type="beta" label="베타" serviceLocale="ko" muted />
                <PatchBalanceChip label="밸런스" serviceLocale="ko" muted />
                <span className="ml-auto inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                  Steam 원문 &rarr;
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                슬서운변경을 만드는 중입니다.
              </p>
              <p className="mt-2 text-xs text-zinc-600">2026-09-18</p>
              {art112 && <PatchArtPreview art={art112} tone="building" />}
            </div>
          </div>

          {/* Card 5: Watching card (prep_time) */}
          <div>
            <span className="text-xs font-semibold text-amber-400/80">
              ▼ 대기 중 (Watching - prep_time) 상태 카드
            </span>
            <div className="mt-1.5 block rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 shadow-inner">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-amber-200/80">
                  <Image
                    src="/images/sts2/intents/animated/sleep.webp"
                    alt="수면"
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <span>준비 시간</span>
                </span>
                <PatchTypeChip type="beta" label="베타" serviceLocale="ko" muted />
              </div>
              <p className="mt-1 text-sm font-medium text-amber-100/75">
                오늘의 패치가 드러나기를 기다리고 있습니다 ...
              </p>
              <p className="mt-2 text-xs text-amber-100/45">2026-09-18</p>
              {artWatch && <PatchArtPreview art={artWatch} tone="watching" />}
            </div>
          </div>
        </div>
      </section>

      {/* 4. 배신+ 본문: 변형(Transfigure) 연동 애니메이션 프리뷰 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold text-foreground">
            4. 배신+ 본문: 변형 서비스 연동 &amp; 인덱스 카드 애셋 쇼케이스
          </h2>
          <span className="text-xs text-muted-foreground">
            이아저? 월드컵 VS 애니메이션 코드 재사용·확장
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          실제 배신+ 패치 상세 페이지(<code>/patches/2026-09-11</code>) 본문에 렌더링되는 컴포넌트입니다.
          실제 커뮤니티 변형 인덱스 카드 애셋(제목, 시간, 댓글·좋아요, 리소스 프리뷰, 작성자)이 진입 즉시 무작위로 선택되며 3.2초 주기로 부드럽게 페이드 전환됩니다.
          호버 시 전환이 일시 정지되고 &quot;변형으로 이동하기&quot; 팁이 노출되며, 클릭 시 해당 변형 상세로 라우팅됩니다.
        </p>

        <BackstabTransfigureSection
          entities={entities}
          entityMap={entityMap}
          serviceLocale="ko"
          gameLocale="kor"
          transfigureTitle={patchBackstabCopy.transfigureTitle}
          transfigureLead={patchBackstabCopy.transfigureLead}
          transfigureCta={patchBackstabCopy.transfigureCta}
          initialPosts={initialTransfigures}
        />
      </section>

      {/* Footer info */}
      <div className="border-t border-border pt-4 text-xs text-muted-foreground flex justify-between">
        <span>Scare the Spire — Patch Notes Catalog DEV</span>
        <Link href="/patches" className="text-primary hover:underline">
          실제 /patches 목록으로 이동 &rarr;
        </Link>
      </div>
    </div>
  );
}
