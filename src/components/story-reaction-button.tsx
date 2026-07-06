"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "@/components/ui/static-image";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useStoryReactions } from "@/hooks/use-story-reactions";
import { cn } from "@/lib/utils";
import {
  DEFAULT_STORY_REACTION,
  STORY_REACTIONS,
  storyReactionByType,
  type StoryReactionCounts,
  type StoryReactionType,
} from "@/lib/reactions";

const WHEEL_SIZE = 220;
const CENTER_RADIUS = 28;
const OUTER_RADIUS = 118;
const WEDGE_RADIUS = 66;
const SELECTED_WEDGE_RADIUS = 76;
const WEDGE_ASSET = "/images/sts2/ui/emote/wedge_2.png";
const WEDGE_SHADOW_ASSET = "/images/sts2/ui/emote/wedge_shadow.png";
const MARKER_ASSET = "/images/sts2/map/markers/map_marker_ironclad.png";

function reactionFromPoint(root: HTMLDivElement | null, clientX: number, clientY: number): StoryReactionType | null {
  if (!root) return null;
  const rect = root.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy);
  if (distance < CENTER_RADIUS || distance > OUTER_RADIUS) return null;

  const wrapped = (Math.atan2(dy, dx) + Math.PI / 8 + Math.PI * 2) % (Math.PI * 2);
  const index = Math.floor(wrapped / (Math.PI / 4));
  return STORY_REACTIONS[index]?.type ?? null;
}

function reactionAngle(reactionType: StoryReactionType): number {
  return Math.max(0, STORY_REACTIONS.findIndex((reaction) => reaction.type === reactionType)) * 45;
}

function wedgeStyle(index: number, selected: boolean): CSSProperties {
  const angle = index * 45;
  const radians = (angle * Math.PI) / 180;
  const radius = selected ? SELECTED_WEDGE_RADIUS : WEDGE_RADIUS;
  const x = Math.cos(radians) * radius;
  const y = Math.sin(radians) * radius;

  return {
    left: "50%",
    top: "50%",
    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle}deg)`,
  };
}

export function StoryReactionButton({
  storyId,
  userId,
  initialCounts,
  initialTotal,
  authReady = true,
  userStatusLoading = "eager",
  ensureUser,
  className = "",
}: {
  storyId: string;
  userId: string | null;
  initialCounts?: StoryReactionCounts;
  initialTotal?: number;
  authReady?: boolean;
  userStatusLoading?: "eager" | "lazy";
  ensureUser?: () => Promise<string | null>;
  className?: string;
}) {
  const serviceLocale = useServiceLocale();
  const { counts, total, selectedReaction, loading, unavailable, selectReaction } = useStoryReactions(storyId, userId, {
    initialCounts,
    initialTotal,
    userStatusLoading,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ignoreNextClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<StoryReactionType | null>(null);

  const pending = !authReady || loading || authPending;
  const blocked = unavailable;
  const disabled = pending || blocked || (!userId && !ensureUser);
  const triggerReaction = storyReactionByType(selectedReaction ?? DEFAULT_STORY_REACTION);
  const activeWheelReaction = hoveredReaction ?? selectedReaction ?? null;
  const markerAngle = activeWheelReaction ? reactionAngle(activeWheelReaction) - 90 : 0;
  const triggerLabel = serviceLocale === "ko" ? "반응" : "Reaction";

  const handleSelect = useCallback(async (reactionType: StoryReactionType) => {
    if (disabled) return;
    setAuthPending(true);
    try {
      let activeUserId = userId;
      if (!activeUserId && ensureUser) {
        activeUserId = await ensureUser();
      }
      if (!activeUserId) return;
      await selectReaction(reactionType, activeUserId);
      setOpen(false);
      setHoveredReaction(null);
    } finally {
      setAuthPending(false);
    }
  }, [disabled, ensureUser, selectReaction, userId]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      setHoveredReaction(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setHoveredReaction(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      setHoveredReaction(reactionFromPoint(rootRef.current, event.clientX, event.clientY));
    };

    const handlePointerUp = (event: PointerEvent) => {
      const reactionType = reactionFromPoint(rootRef.current, event.clientX, event.clientY);
      setDragging(false);
      if (reactionType) {
        void handleSelect(reactionType);
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
    document.addEventListener("pointercancel", handlePointerUp, { once: true });
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragging, handleSelect]);

  const handleTriggerClick = () => {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    if (disabled) return;
    setOpen((value) => !value);
    setHoveredReaction(null);
  };

  const handleTriggerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" || disabled) return;
    event.preventDefault();
    ignoreNextClickRef.current = true;
    setOpen(true);
    setDragging(true);
    setHoveredReaction(null);
  };

  const renderedReactions = useMemo(
    () => STORY_REACTIONS.map((reaction, index) => {
      const angle = index * 45;
      const selected = activeWheelReaction === reaction.type;
      const label = serviceLocale === "ko" ? reaction.labelKo : reaction.labelEn;
      const count = counts[reaction.type] ?? 0;

      return (
        <button
          key={reaction.type}
          type="button"
          aria-label={count > 0 ? `${label} ${count}` : label}
          className={cn(
            "absolute h-[100px] w-[96px] border-0 bg-transparent p-0 transition-transform duration-75 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70",
          )}
          style={wedgeStyle(index, selected)}
          onClick={(event) => {
            event.stopPropagation();
            void handleSelect(reaction.type);
          }}
          onMouseEnter={() => setHoveredReaction(reaction.type)}
          onMouseLeave={() => setHoveredReaction(null)}
        >
          <Image
            src={WEDGE_SHADOW_ASSET}
            alt=""
            width={96}
            height={100}
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain opacity-40"
          />
          <Image
            src={WEDGE_ASSET}
            alt=""
            width={96}
            height={100}
            aria-hidden
            className={cn("absolute inset-0 h-full w-full object-contain transition-opacity", selected ? "opacity-75" : "opacity-35")}
          />
          <Image
            src={reaction.asset}
            alt=""
            width={44}
            height={44}
            aria-hidden
            className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]"
            style={{ transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}
          />
        </button>
      );
    }),
    [activeWheelReaction, counts, handleSelect, serviceLocale],
  );

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onPointerDown={handleTriggerPointerDown}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={triggerLabel}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-all disabled:opacity-30"
      >
        {blocked ? (
          <EngagementUnavailableIcon size={20} />
        ) : pending ? (
          <EngagementSpinner size={20} />
        ) : (
          <>
            <Image
              src={triggerReaction.asset}
              alt=""
              width={20}
              height={20}
              aria-hidden
              className={cn("h-5 w-5 object-contain transition-all", selectedReaction ? "" : "opacity-45 grayscale")}
            />
            <span>{total}</span>
          </>
        )}
      </button>

      {open && !blocked && (
        <div
          ref={rootRef}
          role="menu"
          className="absolute -right-[92px] -top-[202px] z-50 touch-none select-none"
          style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
          onPointerMove={(event) => setHoveredReaction(reactionFromPoint(rootRef.current, event.clientX, event.clientY))}
          onPointerLeave={() => {
            if (!dragging) setHoveredReaction(null);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-100/10 blur-[1px]" />
          {renderedReactions}
          <Image
            src={MARKER_ASSET}
            alt=""
            width={32}
            height={32}
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity",
              activeWheelReaction ? "opacity-95" : "opacity-0",
            )}
            style={{ transform: `translate(-50%, -50%) rotate(${markerAngle}deg)` }}
          />
        </div>
      )}
    </div>
  );
}
