"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { ChemicalXEditor } from "@/components/chemicalx/chemicalx-editor";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { ComboEditor } from "@/components/combo/combo-editor";
import { ComboPostRenderer } from "@/components/combo/combo-post-renderer";
import { CommentComposer } from "@/components/comment-section";
import { DefragmentComposer } from "@/components/defragment/defragment-composer";
import { DefragmentOverlayBodyEditor } from "@/components/defragment/defragment-overlay-body";
import type { PagestormEditorSaveInput } from "@/components/pagestorm/pagestorm-editor";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import { TextEffectToolbar } from "@/components/text-effects/toolbar";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { HistoryRunFloorBlock, PostBlock } from "@/lib/chemical-types";
import type { PagestormDoc } from "@/lib/pagestorm";
import { pagestormFeatureSampleDoc } from "@/components/pagestorm/sample";
import {
  CHEMICAL_X_SAMPLE,
  COMBO_SAMPLE,
  COMMENT_SAMPLE,
  DEFRAGMENT_OVERLAY_SAMPLE,
  DEFRAGMENT_SAMPLE,
  DEFRAGMENT_SAMPLE_TITLE,
  HISTORY_COURSE_SAMPLE,
  TRANSFIGURE_SAMPLE,
} from "./editor-samples";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((mod) => mod.RichContentEditor),
  { ssr: false },
);

const PagestormEditor = dynamic(
  () => import("@/components/pagestorm/pagestorm-editor").then((mod) => mod.PagestormEditor),
  { ssr: false },
);

/** Drafts live under their own keys so testing here never touches real drafts. */
const DRAFT_PREFIX = "sts-dev-editors";

function clearDevDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(DRAFT_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable; the editors still remount with samples.
  }
}

const FLOOR_CATALOG: HistoryRunFloorBlock[] = [
  { type: "history-run-floor", floor: 1, actIndex: 0, step: 0, mapPointType: "monster" },
  { type: "history-run-floor", floor: 6, actIndex: 0, step: 5, mapPointType: "elite" },
  { type: "history-run-floor", floor: 9, actIndex: 0, step: 8, mapPointType: "rest_site" },
  { type: "history-run-floor", floor: 12, actIndex: 0, step: 11, mapPointType: "shop" },
  { type: "history-run-floor", floor: 17, actIndex: 0, step: 16, mapPointType: "boss" },
];

const CLIPBOARD_SAMPLES = [
  { label: "외부 링크", text: "https://store.steampowered.com/app/2868840/Slay_the_Spire_2/" },
  { label: "내부 경로", text: "/byrdispatch" },
  { label: "YouTube", text: "https://www.youtube.com/watch?v=uC_k4W41Gg4" },
  { label: "키워드", text: "강펀치{타격}" },
  { label: "STS1", text: "{타격#1}" },
];

const TRIGGERS: Array<{ key: string; text: string }> = [
  { key: "{", text: "게임 요소 검색. 문구{키워드} 는 문구를 남긴 채 연결, } 로 확정" },
  { key: "/", text: "서류 폭풍: 사이트 경로, 코오오옴보: 슬래시 명령" },
  { key: "#", text: "역사 강의서 댓글: 층 언급" },
  { key: "@ *", text: "변형 설명: 에너지·별 아이콘" },
  { key: "클릭", text: "링크·키워드는 이동하지 않고 버블의 '새 탭에서 열기'로 연다. ⌘/Ctrl+클릭은 바로 새 탭" },
];

function Section({
  id,
  title,
  usedBy,
  children,
}: {
  id: string;
  title: string;
  usedBy: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 space-y-3 rounded-xl border border-border bg-card/40 p-3 sm:p-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-game-title text-lg font-bold text-primary">{title}</h2>
        <p className="text-xs text-muted-foreground">{usedBy}</p>
      </header>
      {children}
    </section>
  );
}

function Output({ children, empty }: { children: ReactNode; empty: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-background/40 p-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">뷰어</p>
      {empty ? (
        <p className="text-xs text-muted-foreground">등록하면 서비스 뷰어로 렌더합니다.</p>
      ) : (
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{children}</div>
      )}
    </div>
  );
}

function ClipboardSamples() {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">붙여넣기 샘플</span>
      {CLIPBOARD_SAMPLES.map((sample) => (
        <button
          key={sample.label}
          type="button"
          title={sample.text}
          onClick={() => {
            void navigator.clipboard?.writeText(sample.text).then(() => setCopied(sample.label));
          }}
          className={`rounded border px-2 py-1 text-xs transition-colors ${
            copied === sample.label
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {sample.label}
          {copied === sample.label ? " ✓" : ""}
        </button>
      ))}
    </div>
  );
}

const NAV = [
  ["comment", "댓글"],
  ["comment-inline", "댓글 (인라인)"],
  ["history-course", "역사 강의서 댓글"],
  ["chemical-x", "케미컬X"],
  ["combo", "코오오옴보"],
  ["defragment", "조각모음"],
  ["defragment-overlay", "조각모음 오버레이"],
  ["transfigure", "변형 설명"],
  ["pagestorm", "서류 폭풍"],
] as const;

export default function EditorsDevPageClient() {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const { entities } = useCommentEntities();
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const [outputs, setOutputs] = useState<Record<string, PostBlock[]>>({});
  const [defragmentTitle, setDefragmentTitle] = useState("");
  const [effectEditor, setEffectEditor] = useState<Editor | null>(null);
  const [pagestormTitle, setPagestormTitle] = useState("Lorem ipsum 서류 폭풍");
  // Bumped to remount every editor from its sample.
  const [generation, setGeneration] = useState(0);
  const pagestormSample = useMemo(() => pagestormFeatureSampleDoc() as PagestormDoc, []);
  const [pagestormNickname, setPagestormNickname] = useState("개발자");
  const [pagestormSaved, setPagestormSaved] = useState<{ doc: PagestormDoc; version: number } | null>(null);

  const keep = useCallback((key: string) => async (blocks: PostBlock[]) => {
    setOutputs((current) => ({ ...current, [key]: blocks }));
  }, []);
  const keepLive = useCallback((key: string) => (blocks: PostBlock[]) => {
    setOutputs((current) => ({ ...current, [key]: blocks }));
  }, []);
  const onComment = useMemo(() => keep("comment"), [keep]);
  const onCommentInline = useMemo(() => keep("comment-inline"), [keep]);
  const onHistory = useMemo(() => keep("history-course"), [keep]);
  const onOverlay = useMemo(() => keepLive("defragment-overlay"), [keepLive]);
  const onTransfigure = useMemo(() => keepLive("transfigure"), [keepLive]);
  const onPagestormSubmit = useCallback(async (input: PagestormEditorSaveInput) => {
    setPagestormSaved((current) => ({ doc: input.content, version: (current?.version ?? 0) + 1 }));
  }, []);

  const view = (key: string) => (
    <Output empty={!outputs[key]?.length}>
      <PostRenderer
        blocks={outputs[key] ?? []}
        entityMap={entityMap}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
    </Output>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <header className="space-y-3">
        <div>
          <h1 className="font-game-title text-2xl font-bold">에디터 모음</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            서비스 에디터를 실제 컴포넌트 그대로 띄웁니다. 등록은 서버에 보내지 않고 아래 뷰어에만 렌더합니다.
            임시 저장은 <code className="text-xs">{DRAFT_PREFIX}:*</code> 키를 씁니다.
          </p>
        </div>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          {TRIGGERS.map((trigger) => (
            <li key={trigger.key}>
              <span className="mr-1.5 inline-block min-w-8 rounded border border-border px-1 text-center font-mono text-primary">
                {trigger.key}
              </span>
              {trigger.text}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ClipboardSamples />
          <button
            type="button"
            onClick={() => {
              clearDevDrafts();
              setOutputs({});
              setPagestormSaved(null);
              setGeneration((value) => value + 1);
            }}
            className="rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            모든 에디터를 샘플로 되돌리기
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          각 에디터는 그 서비스의 기능을 모두 쓴 로렘입숨 글로 시작합니다. 고친 내용은 이 탭의 임시 저장에 남습니다.
        </p>
        <nav className="flex flex-wrap gap-1.5 text-xs">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="comment" title="댓글" usedBy="모든 리소스 페이지, 패치노트, 이거 아님 저거?, 다채로운 철학자들">
        <CommentComposer
          key={`comment-${generation}`}
          entities={entities}
          initialBlocks={COMMENT_SAMPLE}
          onSubmit={onComment}
          placeholder="댓글을 남겨 보세요"
          draftKey={`${DRAFT_PREFIX}:comment`}
          submitLabel="등록"
        />
        {view("comment")}
      </Section>

      <Section id="comment-inline" title="댓글 (인라인)" usedBy="역사 강의서 재생 화면 같은 좁은 자리">
        <CommentComposer
          key={`comment-inline-${generation}`}
          entities={entities}
          initialBlocks={COMMENT_SAMPLE.slice(0, 4)}
          onSubmit={onCommentInline}
          placeholder="짧게 남기기"
          draftKey={`${DRAFT_PREFIX}:comment-inline`}
          submitLabel="등록"
          density="inline"
        />
        {view("comment-inline")}
      </Section>

      <Section id="history-course" title="역사 강의서 댓글" usedBy="역사 강의서 런 상세 (# 층 언급)">
        <CommentComposer
          key={`history-${generation}`}
          entities={entities}
          initialBlocks={HISTORY_COURSE_SAMPLE}
          onSubmit={onHistory}
          placeholder="#6 처럼 층을 언급해 보세요"
          draftKey={`${DRAFT_PREFIX}:history-course`}
          submitLabel="등록"
          historyFloorMentions={{ catalog: FLOOR_CATALOG, currentFloor: 6 }}
          floorHashTip={{ token: "#", text: "층 번호로 언급 ", example: "#6" }}
        />
        {view("history-course")}
      </Section>

      <Section id="chemical-x" title="케미컬X" usedBy="케미컬X 글쓰기">
        <ChemicalXEditor
          key={`chemical-x-${generation}`}
          entities={entities}
          initialBlocks={CHEMICAL_X_SAMPLE}
          placeholder="게임 요소로 짧은 글 쓰기"
          profileNickname="개발자"
          draftKey={`${DRAFT_PREFIX}:chemical-x`}
          onSubmit={async (blocks) => {
            setOutputs((current) => ({ ...current, "chemical-x": blocks }));
          }}
        />
        {view("chemical-x")}
      </Section>

      <Section id="combo" title="코오오옴보" usedBy="코오오옴보 글쓰기 (게임 요소 2개 이상, YouTube 1개, / 명령)">
        <ComboEditor
          key={`combo-${generation}`}
          entities={entities}
          initialBlocks={COMBO_SAMPLE}
          placeholder="콤보를 적어 보세요"
          profileNickname="개발자"
          serviceLocale={serviceLocale}
          draftKey={`${DRAFT_PREFIX}:combo`}
          onSubmit={async (blocks) => {
            setOutputs((current) => ({ ...current, combo: blocks }));
          }}
        />
        <Output empty={!outputs.combo?.length}>
          <ComboPostRenderer
            blocks={outputs.combo ?? []}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        </Output>
      </Section>

      <Section id="defragment" title="조각모음" usedBy="조각모음 글쓰기 (제목 + 본문, Enter는 줄바꿈)">
        <DefragmentComposer
          key={`defragment-${generation}`}
          entities={entities}
          initialTitle={DEFRAGMENT_SAMPLE_TITLE}
          initialBlocks={DEFRAGMENT_SAMPLE}
          placeholder="본문"
          profileNickname="개발자"
          submitLabel="등록"
          draftKey={`${DRAFT_PREFIX}:defragment`}
          onSubmit={async ({ title, blocks }) => {
            setDefragmentTitle(title);
            setOutputs((current) => ({ ...current, defragment: blocks }));
          }}
        />
        <Output empty={!outputs.defragment?.length}>
          <p className="mb-1 font-semibold">{defragmentTitle}</p>
          <PostRenderer
            blocks={outputs.defragment ?? []}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        </Output>
      </Section>

      <Section id="defragment-overlay" title="조각모음 오버레이 본문" usedBy="조각모음 이미지 위 본문 (입력 즉시 반영)">
        <DefragmentOverlayBodyEditor
          key={`defragment-overlay-${generation}`}
          entities={entities}
          initialBlocks={DEFRAGMENT_OVERLAY_SAMPLE}
          placeholder="오버레이 본문"
          draftKey={`${DRAFT_PREFIX}:defragment-overlay`}
          onBlocksChange={onOverlay}
        />
        {view("defragment-overlay")}
      </Section>

      <Section id="transfigure" title="변형 설명" usedBy="변형 카드 설명 칸 (색·효과 버블, @ 에너지, * 별, 링크 없는 키워드)">
        {/* Mirrors the description editor in transfigure-asset-editor.tsx. */}
        <div className="mx-auto h-44 w-64 rounded-lg border border-border bg-[#2b2f38] p-2 text-[#FFF6E2] [text-shadow:2px_2px_0_rgba(0,0,0,0.45)]">
          <TextEffectToolbar editor={effectEditor} serviceLocale={serviceLocale} />
          <RichContentEditor
            key={`transfigure-${generation}`}
            entities={entities}
            initialBlocks={TRANSFIGURE_SAMPLE}
            onSubmit={async () => {}}
            onBlocksChange={onTransfigure}
            placeholder="피해를 6 줍니다."
            draftKey={`${DRAFT_PREFIX}:transfigure`}
            submitLabel="등록"
            maxChars={null}
            embedded
            textEffects
            onEditor={setEffectEditor}
            allowLineBreaks
            entityLinks={false}
            submitOnEnter={false}
            costTokens={{ energyIconSrc: "/images/game-assets/card-misc/energy_colorless.png" }}
          />
        </div>
        {view("transfigure")}
      </Section>

      <Section id="pagestorm" title="서류 폭풍" usedBy="서류 폭풍 글쓰기 (블록, 표, 이미지, / 경로, {요소}, 링크)">
        <PagestormEditor
          key={`pagestorm-${generation}`}
          mode="edit"
          initialContent={pagestormSample}
          title={pagestormTitle}
          onTitleChange={setPagestormTitle}
          nickname={pagestormNickname}
          onNicknameChange={setPagestormNickname}
          submitLabel="미리보기 갱신"
          onSubmit={onPagestormSubmit}
        />
        <div className="rounded-lg border border-dashed border-border/80 bg-background/40 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">뷰어</p>
          {pagestormSaved ? (
            <PagestormEditor
              key={pagestormSaved.version}
              mode="preview"
              initialContent={pagestormSaved.doc}
            />
          ) : (
            <p className="text-xs text-muted-foreground">제목을 쓰고 미리보기 갱신을 누르면 읽기 모드로 렌더합니다.</p>
          )}
        </div>
      </Section>
    </main>
  );
}
