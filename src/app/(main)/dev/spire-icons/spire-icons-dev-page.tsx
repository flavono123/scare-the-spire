"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  Apple,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  ClipboardCopy,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  EyeOff,
  FolderUp,
  Link2,
  Loader2,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Shrink,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  Undo2,
  Upload,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";

type TokenKind = "유물" | "파워" | "포션" | "이벤트";

type TokenOption = {
  id: string;
  label: string;
  kind: TokenKind;
  src: string;
};

const TOKENS = [
  {
    id: "trash-to-treasure",
    label: "고철을 보물로",
    kind: "파워",
    src: "/images/sts2/powers/trash_to_treasure_power.webp",
  },
  {
    id: "whisper-bubble",
    label: "인형의 방 속삭임 말풍선",
    kind: "이벤트",
    src: "/images/sts2/event-vfx/doll_room_whisper_bubble_l.webp",
  },
  {
    id: "necro-mastery",
    label: "강령의 극의",
    kind: "파워",
    src: "/images/sts2/powers/necro_mastery_power.webp",
  },
  {
    id: "vital-spark",
    label: "생명의 불꽃",
    kind: "파워",
    src: "/images/sts2/powers/vital_spark_power.webp",
  },
  {
    id: "strawberry",
    label: "딸기",
    kind: "유물",
    src: "/images/sts2/relics/strawberry.webp",
  },
  {
    id: "dexterity-down",
    label: "민첩 감소",
    kind: "파워",
    src: "/images/sts2/powers/dexterity_down_power.webp",
  },
  {
    id: "back-attack-left",
    label: "후방 공격 · 왼쪽",
    kind: "파워",
    src: "/images/sts2/powers/back_attack_left_power.webp",
  },
  {
    id: "strength",
    label: "힘",
    kind: "파워",
    src: "/images/sts2/powers/strength_power.webp",
  },
  {
    id: "winged-boots",
    label: "날개 달린 부츠",
    kind: "유물",
    src: "/images/sts2/relics/winged_boots.webp",
  },
  {
    id: "dusty-tome",
    label: "먼지 쌓인 책",
    kind: "유물",
    src: "/images/sts2/relics/dusty_tome.webp",
  },
  {
    id: "accuracy",
    label: "정밀",
    kind: "파워",
    src: "/images/sts2/powers/accuracy_power.webp",
  },
  {
    id: "artifact",
    label: "인공물",
    kind: "파워",
    src: "/images/sts2/powers/artifact_power.webp",
  },
  {
    id: "back-attack-right",
    label: "후방 공격 · 오른쪽",
    kind: "파워",
    src: "/images/sts2/powers/back_attack_right_power.webp",
  },
  {
    id: "spinner",
    label: "스피너",
    kind: "파워",
    src: "/images/sts2/powers/spinner_power.webp",
  },
  {
    id: "wongos-ticket",
    label: "웡고스 비밀 티켓",
    kind: "유물",
    src: "/images/sts2/relics/wongos_mystery_ticket.webp",
  },
  {
    id: "massive-scroll",
    label: "대형 두루마리",
    kind: "유물",
    src: "/images/sts2/relics/massive_scroll.webp",
  },
  {
    id: "duplication",
    label: "복사",
    kind: "파워",
    src: "/images/sts2/powers/duplication_power.webp",
  },
  {
    id: "scroll-boxes",
    label: "두루마리 상자",
    kind: "유물",
    src: "/images/sts2/relics/scroll_boxes.webp",
  },
  {
    id: "circlet",
    label: "서클렛",
    kind: "유물",
    src: "/images/sts2/relics/circlet.webp",
  },
  {
    id: "gold-plated-cables",
    label: "판금 케이블",
    kind: "유물",
    src: "/images/sts2/relics/gold_plated_cables.webp",
  },
  {
    id: "wing-charm",
    label: "날개 부적",
    kind: "유물",
    src: "/images/sts2/relics/wing_charm.webp",
  },
  {
    id: "glass-eye",
    label: "유리 눈",
    kind: "유물",
    src: "/images/sts2/relics/glass_eye.webp",
  },
  {
    id: "ghost-in-a-jar",
    label: "단지 속의 유령",
    kind: "포션",
    src: "/images/sts2/potions/ghost_in_a_jar.webp",
  },
  {
    id: "chains-of-binding",
    label: "속박의 사슬",
    kind: "파워",
    src: "/images/sts2/powers/chains_of_binding_power.webp",
  },
  {
    id: "unceasing-top",
    label: "멈추지 않는 팽이",
    kind: "유물",
    src: "/images/sts2/relics/unceasing_top.webp",
  },
  {
    id: "emotion-chip",
    label: "감정 칩",
    kind: "유물",
    src: "/images/sts2/relics/emotion_chip.webp",
  },
  {
    id: "book-repair-knife",
    label: "책 수리용 칼",
    kind: "유물",
    src: "/images/sts2/relics/book_repair_knife.webp",
  },
  {
    id: "automation",
    label: "자동화",
    kind: "파워",
    src: "/images/sts2/powers/automation_power.webp",
  },
  {
    id: "reflect",
    label: "반사",
    kind: "파워",
    src: "/images/sts2/powers/reflect_power.webp",
  },
  {
    id: "dowsing-rod",
    label: "다우징 로드",
    kind: "유물",
    src: "/images/sts2/relics/dowsing_rod.webp",
  },
  {
    id: "paels-wing",
    label: "파엘의 날개",
    kind: "유물",
    src: "/images/sts2/relics/paels_wing.webp",
  },
  {
    id: "shrink",
    label: "압축",
    kind: "파워",
    src: "/images/sts2/powers/shrink_power.webp",
  },
  {
    id: "gambling-chip",
    label: "도박용 칩",
    kind: "유물",
    src: "/images/sts2/relics/gambling_chip.webp",
  },
  {
    id: "tools-of-the-trade",
    label: "작업 도구",
    kind: "파워",
    src: "/images/sts2/powers/tools_of_the_trade_power.webp",
  },
  {
    id: "prismatic-gem",
    label: "프리즘 보석",
    kind: "유물",
    src: "/images/sts2/relics/prismatic_gem.webp",
  },
  {
    id: "dollys-mirror",
    label: "돌리의 거울",
    kind: "유물",
    src: "/images/sts2/relics/dollys_mirror.webp",
  },
  {
    id: "arcane-scroll",
    label: "비전 두루마리",
    kind: "유물",
    src: "/images/sts2/relics/arcane_scroll.webp",
  },
  {
    id: "no-block",
    label: "방어 불가",
    kind: "파워",
    src: "/images/sts2/powers/no_block_power.webp",
  },
  {
    id: "fresnel-lens",
    label: "프레넬 렌즈",
    kind: "유물",
    src: "/images/sts2/relics/fresnel_lens.webp",
  },
] as const satisfies readonly TokenOption[];

type TokenId = (typeof TOKENS)[number]["id"];

const TOKEN_BY_ID = new Map<TokenId, (typeof TOKENS)[number]>(
  TOKENS.map((token) => [token.id, token]),
);

const SPIRE_COLORS = [
  { id: "gold", label: "Gold", hex: "#d4a843" },
  { id: "blue", label: "Blue", hex: "#60a5fa" },
  { id: "red", label: "Red", hex: "#f87171" },
  { id: "green", label: "Green", hex: "#34d399" },
  { id: "purple", label: "Purple", hex: "#c084fc" },
  { id: "orange", label: "Orange", hex: "#fb923c" },
  { id: "pink", label: "Pink", hex: "#f472b6" },
  { id: "aqua", label: "Aqua", hex: "#22d3ee" },
] as const;

type SpireColorId = (typeof SPIRE_COLORS)[number]["id"];
type VariantId = "original" | "ghost" | SpireColorId;

const VARIANT_LABELS: Record<VariantId, string> = {
  original: "원본",
  ghost: "Ghost · 밀랍 셰이더",
  gold: "spire-gold",
  blue: "spire-blue",
  red: "spire-red",
  green: "spire-green",
  purple: "spire-purple",
  orange: "spire-orange",
  pink: "spire-pink",
  aqua: "spire-aqua",
};

type IconRow = {
  icon: LucideIcon;
  iconName: string;
  usage: string;
  tokenId: TokenId;
};

const ICON_ROWS: readonly IconRow[] = [
  {
    icon: AlertCircle,
    iconName: "AlertCircle",
    usage: "이야기 작성 모달 · /history-course 업로드",
    tokenId: "vital-spark",
  },
  {
    icon: Apple,
    iconName: "Apple",
    usage: "/history-course 업로드 안내 (macOS)",
    tokenId: "strawberry",
  },
  {
    icon: ArrowDown,
    iconName: "ArrowDown",
    usage: "/patches/changes 정렬",
    tokenId: "dexterity-down",
  },
  {
    icon: ArrowLeft,
    iconName: "ArrowLeft",
    usage: "/this-or-that/* · /c-c-c-combo/* · /chemical-x/* · /transfigure/*",
    tokenId: "back-attack-left",
  },
  {
    icon: ArrowUp,
    iconName: "ArrowUp",
    usage: "/patches/changes 정렬",
    tokenId: "strength",
  },
  {
    icon: ArrowUpRight,
    iconName: "ArrowUpRight",
    usage: "/c-c-c-combo/* 승천 기록 링크",
    tokenId: "winged-boots",
  },
  {
    icon: BookOpen,
    iconName: "BookOpen",
    usage: "/c-c-c-combo 작성기 · 승천 기록 선택",
    tokenId: "dusty-tome",
  },
  {
    icon: Check,
    iconName: "Check",
    usage: "비교·콤보·변형술 선택기 · 복사 완료",
    tokenId: "accuracy",
  },
  {
    icon: CheckCircle2,
    iconName: "CheckCircle2",
    usage: "이야기 작성 모달 · 저장 성공",
    tokenId: "artifact",
  },
  {
    icon: ChevronRight,
    iconName: "ChevronRight",
    usage: "/profile 활동 상세",
    tokenId: "back-attack-right",
  },
  {
    icon: ChevronsUpDown,
    iconName: "ChevronsUpDown",
    usage: "/patches/changes 정렬 선택",
    tokenId: "spinner",
  },
  {
    icon: CircleHelp,
    iconName: "CircleHelp",
    usage: "/patches/changes 도움말",
    tokenId: "wongos-ticket",
  },
  {
    icon: ClipboardCopy,
    iconName: "ClipboardCopy",
    usage: "/transfigure/* 이미지 복사",
    tokenId: "massive-scroll",
  },
  {
    icon: Copy,
    iconName: "Copy",
    usage: "/history-course 공유 · 업로드 안내",
    tokenId: "duplication",
  },
  {
    icon: Download,
    iconName: "Download",
    usage: "/transfigure/* 이미지 다운로드",
    tokenId: "scroll-boxes",
  },
  {
    icon: Ellipsis,
    iconName: "Ellipsis",
    usage: "/patches/changes 메뉴",
    tokenId: "circlet",
  },
  {
    icon: EllipsisVertical,
    iconName: "EllipsisVertical",
    usage: "/patches/changes 세로 메뉴",
    tokenId: "gold-plated-cables",
  },
  {
    icon: ExternalLink,
    iconName: "ExternalLink",
    usage: "/chemical-x 카드 · /dev/history-course 운영 목록",
    tokenId: "wing-charm",
  },
  {
    icon: Eye,
    iconName: "Eye",
    usage: "/chemical-x 공개 보기",
    tokenId: "glass-eye",
  },
  {
    icon: EyeOff,
    iconName: "EyeOff",
    usage: "/chemical-x 숨김",
    tokenId: "ghost-in-a-jar",
  },
  {
    icon: FolderUp,
    iconName: "FolderUp",
    usage: "/history-course 기록 파일 선택",
    tokenId: "scroll-boxes",
  },
  {
    icon: Link2,
    iconName: "Link2",
    usage: "게시글 공유 링크 · 비교/콤보/변형술 상세",
    tokenId: "chains-of-binding",
  },
  {
    icon: Loader2,
    iconName: "Loader2",
    usage: "/dev/history-course 운영 목록 로딩",
    tokenId: "spinner",
  },
  {
    icon: LoaderCircle,
    iconName: "LoaderCircle",
    usage: "에디터 YouTube · 기록 선택 · 프로필 · 이미지 복사 로딩",
    tokenId: "unceasing-top",
  },
  {
    icon: MessageCircle,
    iconName: "MessageCircle",
    usage: "댓글 (통일 Lucide) · 인덱스 toast-up · tip: 첫 댓글 쓰기 / n개의 댓글",
    tokenId: "whisper-bubble",
  },
  {
    icon: Pencil,
    iconName: "Pencil",
    usage: "상세 수정 (통일 Lucide, spire-gold) · PostDetailActions",
    tokenId: "tools-of-the-trade",
  },
  {
    icon: Play,
    iconName: "Play",
    usage: "/c-c-c-combo YouTube · /dev/history-course 재생",
    tokenId: "automation",
  },
  {
    icon: Plus,
    iconName: "Plus",
    usage: "콤보·변형술 리소스 추가",
    tokenId: "vital-spark",
  },
  {
    icon: RefreshCw,
    iconName: "RefreshCw",
    usage: "/history-course 업로드 재시도 · dev 운영 목록 새로고침",
    tokenId: "reflect",
  },
  {
    icon: Search,
    iconName: "Search",
    usage: "이야기·콤보·변형술·패치·dev 목록 검색",
    tokenId: "dowsing-rod",
  },
  {
    icon: Share2,
    iconName: "Share2",
    usage: "/history-course 기록 공유",
    tokenId: "paels-wing",
  },
  {
    icon: Shrink,
    iconName: "Shrink",
    usage: "/patches/changes 모두 접기",
    tokenId: "shrink",
  },
  {
    icon: Shuffle,
    iconName: "Shuffle",
    usage: "/history-course 무작위 기록",
    tokenId: "gambling-chip",
  },
  {
    icon: SlidersHorizontal,
    iconName: "SlidersHorizontal",
    usage: "/c-c-c-combo 게임 요소 필터",
    tokenId: "tools-of-the-trade",
  },
  {
    icon: Sparkles,
    iconName: "Sparkles",
    usage: "/transfigure · 변형술",
    tokenId: "prismatic-gem",
  },
  {
    icon: Terminal,
    iconName: "Terminal",
    usage: "/history-course 업로드 안내 (Windows)",
    tokenId: "automation",
  },
  {
    icon: Trash2,
    iconName: "Trash2",
    usage: "삭제 (통일 Lucide, red) · 상세 PostDetailActions · 인덱스 미노출",
    tokenId: "trash-to-treasure",
  },
  {
    icon: Undo2,
    iconName: "Undo2",
    usage: "/history-course 공유 취소",
    tokenId: "dollys-mirror",
  },
  {
    icon: Upload,
    iconName: "Upload",
    usage: "/history-course 기록 업로드",
    tokenId: "arcane-scroll",
  },
  {
    icon: X,
    iconName: "X",
    usage: "범용 모달 닫기 · 선택 해제",
    tokenId: "no-block",
  },
  {
    icon: Youtube,
    iconName: "Youtube",
    usage: "범용 에디터 · /c-c-c-combo YouTube 링크",
    tokenId: "fresnel-lens",
  },
];

function variantColor(variant: VariantId): string | null {
  if (variant === "original" || variant === "ghost") return null;
  return SPIRE_COLORS.find((color) => color.id === variant)?.hex ?? null;
}

function TokenIcon({
  token,
  variant,
  size,
}: {
  token: TokenOption;
  variant: VariantId;
  size: number;
}) {
  const dimensions = { width: size, height: size };

  if (variant === "original" || variant === "ghost") {
    const ghostStyle: CSSProperties | undefined = variant === "ghost"
      ? {
          filter: 'url("#spire-icon-wax-filter")',
        }
      : undefined;

    return (
      <span
        className="relative inline-flex shrink-0 items-center justify-center"
        style={dimensions}
        title={`${token.label} · ${VARIANT_LABELS[variant]}`}
      >
        <Image
          alt=""
          className="h-full w-full object-contain"
          height={size}
          src={token.src}
          style={ghostStyle}
          unoptimized
          width={size}
        />
      </span>
    );
  }

  const color = variantColor(variant) ?? "#ffffff";
  const maskStyle: CSSProperties = {
    backgroundColor: color,
    maskImage: `url("${token.src}")`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskImage: `url("${token.src}")`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  };

  return (
    <span
      aria-label={`${token.label} · ${VARIANT_LABELS[variant]}`}
      className="relative inline-flex shrink-0 isolate"
      role="img"
      style={dimensions}
      title={`${token.label} · ${VARIANT_LABELS[variant]}`}
    >
      <Image
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
        height={size}
        src={token.src}
        style={{
          filter: "grayscale(1) contrast(1.12) brightness(0.72)",
          opacity: 0.8,
        }}
        unoptimized
        width={size}
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ ...maskStyle, mixBlendMode: "color", opacity: 0.96 }}
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ ...maskStyle, mixBlendMode: "screen", opacity: 0.18 }}
      />
    </span>
  );
}

function VariantPalette({
  value,
  onChange,
}: {
  value: VariantId;
  onChange: (variant: VariantId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="아이콘 variant 선택">
      <button
        aria-label="원본 variant"
        aria-pressed={value === "original"}
        className={`flex h-7 min-w-9 items-center justify-center rounded border px-1.5 text-[10px] font-semibold transition ${
          value === "original"
            ? "border-white/70 bg-white/15 text-white"
            : "border-white/10 bg-black/20 text-zinc-500 hover:border-white/30"
        }`}
        onClick={() => onChange("original")}
        title="원본"
        type="button"
      >
        원본
      </button>
      <button
        aria-label="Ghost 밀랍 셰이더 variant"
        aria-pressed={value === "ghost"}
        className={`flex h-7 min-w-9 items-center justify-center rounded border px-1.5 text-[10px] font-semibold transition ${
          value === "ghost"
            ? "border-zinc-200/70 bg-zinc-200/15 text-zinc-100"
            : "border-white/10 bg-black/20 text-zinc-500 hover:border-white/30"
        }`}
        onClick={() => onChange("ghost")}
        title="Ghost · 밀랍 셰이더"
        type="button"
      >
        Ghost
      </button>
      {SPIRE_COLORS.map((color) => (
        <button
          key={color.id}
          aria-label={`spire-${color.id} variant`}
          aria-pressed={value === color.id}
          className={`h-7 w-7 rounded-full border-2 transition ${
            value === color.id
              ? "scale-110 border-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]"
              : "border-black/50 opacity-65 hover:scale-105 hover:opacity-100"
          }`}
          onClick={() => onChange(color.id)}
          style={{ backgroundColor: color.hex }}
          title={`spire-${color.id}`}
          type="button"
        />
      ))}
    </div>
  );
}

function IconPreviewRow({ row }: { row: IconRow }) {
  const [variant, setVariant] = useState<VariantId>("original");
  const token = TOKEN_BY_ID.get(row.tokenId) ?? TOKENS[0];
  const CurrentIcon = row.icon;

  return (
    <article className="grid gap-4 border-t border-white/8 px-3 py-4 lg:grid-cols-[minmax(140px,0.8fr)_minmax(260px,1.8fr)_minmax(210px,1.2fr)_minmax(280px,1.6fr)] lg:items-center lg:px-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25">
          <CurrentIcon aria-hidden className="h-5 w-5 text-zinc-300" strokeWidth={1.8} />
        </span>
        <code className="text-xs text-zinc-300">{row.iconName}</code>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
          현재 사용처
        </p>
        <p className="text-sm leading-relaxed text-zinc-400">{row.usage}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-[radial-gradient(circle,rgba(255,255,255,0.07),rgba(0,0,0,0.18))]">
          <TokenIcon size={44} token={token} variant={variant} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-game-title text-sm font-semibold spire-gold">
            {token.label}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {token.kind} · {VARIANT_LABELS[variant]}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600 lg:hidden">
          Variant
        </p>
        <VariantPalette onChange={setVariant} value={variant} />
      </div>
    </article>
  );
}

function TokenWorkbench() {
  const [tokenId, setTokenId] = useState<TokenId>("trash-to-treasure");
  const [variant, setVariant] = useState<VariantId>("ghost");
  const [size, setSize] = useState(96);
  const token = TOKEN_BY_ID.get(tokenId) ?? TOKENS[0];
  const groupedTokens = useMemo(
    () => (["파워", "유물", "포션"] as const).map((kind) => ({
      kind,
      tokens: TOKENS.filter((candidate) => candidate.kind === kind),
    })),
    [],
  );

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-yellow-500/20 bg-zinc-950/65">
      <div className="border-b border-white/8 px-4 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-500/70">
          Free playground
        </p>
        <h2 className="mt-1 font-game-title text-xl font-bold spire-gold">
          임의 토큰 실험
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          추출된 256px 래스터 애셋에 variant만 브라우저에서 합성합니다.
        </p>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(250px,0.8fr)_minmax(320px,1.2fr)]">
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-zinc-400">게임 토큰</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-yellow-500/50"
              onChange={(event) => setTokenId(event.target.value as TokenId)}
              value={tokenId}
            >
              {groupedTokens.map((group) => (
                <optgroup key={group.kind} label={group.kind}>
                  {group.tokens.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-400">Variant</p>
            <VariantPalette onChange={setVariant} value={variant} />
          </div>

          <label className="block">
            <span className="mb-2 flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span>크기</span>
              <code className="text-[11px] text-zinc-600">{size}px</code>
            </span>
            <input
              className="w-full accent-yellow-500"
              max="144"
              min="24"
              onChange={(event) => setSize(Number(event.target.value))}
              step="4"
              type="range"
              value={size}
            />
          </label>
        </div>

        <div className="grid min-h-64 grid-cols-3 overflow-hidden rounded-xl border border-white/10">
          <div className="flex items-center justify-center bg-[#09090b] p-3">
            <TokenIcon size={size} token={token} variant={variant} />
          </div>
          <div className="flex items-center justify-center bg-[#e4e4e7] p-3">
            <TokenIcon size={size} token={token} variant={variant} />
          </div>
          <div
            className="flex items-center justify-center p-3"
            style={{
              backgroundColor: "#27272a",
              backgroundImage:
                "linear-gradient(45deg,#18181b 25%,transparent 25%),linear-gradient(-45deg,#18181b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#18181b 75%),linear-gradient(-45deg,transparent 75%,#18181b 75%)",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              backgroundSize: "16px 16px",
            }}
          >
            <TokenIcon size={size} token={token} variant={variant} />
          </div>
        </div>
      </div>

      <div className="border-t border-white/8 bg-black/20 px-4 py-3 sm:px-6">
        <code className="block break-all text-[10px] text-zinc-600">
          {token.src} · {VARIANT_LABELS[variant]}
        </code>
      </div>
    </section>
  );
}

export default function SpireIconsDevPage() {
  return (
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <svg aria-hidden className="absolute h-0 w-0" focusable="false">
        <filter colorInterpolationFilters="linearRGB" id="spire-icon-wax-filter">
          <feColorMatrix
            type="matrix"
            values="
              0.333333 0.333333 0.333333 0 0
              0.266667 0.266667 0.266667 0 0
              0.266667 0.266667 0.266667 0 0
              0        0        0        1 0
            "
          />
        </filter>
      </svg>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-3 py-2">
        <span className="rounded bg-yellow-500/15 px-2 py-0.5 text-[10px] font-black tracking-[0.12em] text-yellow-400">
          DEV ONLY
        </span>
        <span className="text-xs text-zinc-500">
          개발 서버에서만 열리며 프로덕션에서는 404
        </span>
      </div>

      <header className="grid gap-5 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(212,168,67,0.13),transparent_42%),rgba(9,9,11,0.72)] p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-yellow-500/20 bg-black/30 shadow-[inset_0_0_24px_rgba(212,168,67,0.08)]">
          <TokenIcon size={64} token={TOKENS[0]} variant="gold" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-500/60">
            Spire icon study
          </p>
          <h1 className="mt-1 font-game-title text-2xl font-bold spire-gold sm:text-3xl">
            첨탑식 아이콘 실험실
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            현재 사용 중인 lucide 41종을 실제 게임 토큰 후보와 나란히 비교합니다.
            Ghost는 게임의 밀랍 유물 셰이더를 재현하며, spire 색상은 원본의 명암
            위에 단일 색 레이어를 합성합니다.
          </p>
        </div>
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/55">
        <div className="border-b border-white/8 px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-game-title text-lg font-bold text-zinc-200">
                현재 lucide → 게임 토큰 후보
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                한 행의 선택은 다른 행에 영향을 주지 않습니다.
              </p>
            </div>
            <span className="text-xs tabular-nums text-zinc-600">
              {ICON_ROWS.length} icons · {TOKENS.length} tokens · 10 variants
            </span>
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(140px,0.8fr)_minmax(260px,1.8fr)_minmax(210px,1.2fr)_minmax(280px,1.6fr)] gap-4 bg-black/25 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600 lg:grid">
          <span>Lucide</span>
          <span>현재 사용처</span>
          <span>게임 토큰 후보</span>
          <span>Variant palette</span>
        </div>

        <div>
          {ICON_ROWS.map((row) => (
            <IconPreviewRow key={row.iconName} row={row} />
          ))}
        </div>
      </section>

      <TokenWorkbench />

      <p className="mx-auto mt-5 max-w-3xl text-center text-[11px] leading-relaxed text-zinc-700">
        이 실험은 패키지·SVG 변환·새 애셋 생성을 전제로 하지 않습니다. 원본 WebP와
        브라우저 합성만 사용합니다.
      </p>
    </main>
  );
}
