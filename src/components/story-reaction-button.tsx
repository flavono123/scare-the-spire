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
const SCENE_SIZE = 500;
const SCENE_CENTER = SCENE_SIZE / 2;
const SCENE_SCALE = WHEEL_SIZE / SCENE_SIZE;
const CENTER_RADIUS = 70 * SCENE_SCALE;
const OUTER_RADIUS = 250 * SCENE_SCALE;
const SELECTED_WEDGE_LIFT = 25;
const VIEWPORT_MARGIN = 8;
const WEDGE_ASSET = "/images/sts2/ui/emote/wedge_2.png";
const WEDGE_SHADOW_ASSET = "/images/sts2/ui/emote/wedge_shadow.png";
const MARKER_ASSET = "/images/sts2/map/markers/map_marker_ironclad.png";

type SceneRect = readonly [left: number, top: number, right: number, bottom: number];

const REACTION_WHEEL_LAYOUT: Array<{
  type: StoryReactionType;
  rotation: number;
  icon: SceneRect;
  iconRotation: number;
  shadow: SceneRect;
  wedge: SceneRect;
}> = [
  {
    type: "exclamation",
    rotation: 0,
    wedge: [79.3333, -94, 261.333, 94],
    icon: [-42, -35.5, 42, 35.5],
    iconRotation: 0,
    shadow: [-80.3332, -83.3333, 101.667, 104.667],
  },
  {
    type: "skull",
    rotation: 45,
    wedge: [122, -11.3333, 304, 176.667],
    icon: [-59.1802, 0.0452347, 24.8198, 81.0452],
    iconRotation: -45,
    shadow: [-75.9151, -94.0001, 106.085, 93.9998],
  },
  {
    type: "thumb_down",
    rotation: 90,
    wedge: [92.6667, 78, 274.667, 266],
    icon: [-40, 40, 44, 124],
    iconRotation: -90,
    shadow: [-80.3335, -104.667, 101.666, 83.3333],
  },
  {
    type: "sad_slime",
    rotation: 135,
    wedge: [8.66666, 120.667, 190.667, 308.667],
    icon: [4.4594, 62.2706, 88.4594, 146.271],
    iconRotation: -135,
    shadow: [-91.0001, -109.085, 90.9996, 78.9151],
  },
  {
    type: "question_mark",
    rotation: 180,
    wedge: [-83.3333, 94, 98.6667, 282],
    icon: [42, 42, 126, 126],
    iconRotation: -180,
    shadow: [-101.667, -104.667, 80.3336, 83.3336],
  },
  {
    type: "heart",
    rotation: 225,
    wedge: [-124.667, 12.6667, 57.3333, 200.667],
    icon: [56.0782, -11.9756, 140.078, 59.0244],
    iconRotation: -225,
    shadow: [-106.085, -94.0002, 75.9146, 93.9998],
  },
  {
    type: "thumb_up",
    rotation: 270,
    wedge: [-95.3333, -76.6667, 86.6667, 111.333],
    icon: [36, -39, 120, 45],
    iconRotation: -270,
    shadow: [-101.667, -83.3332, 80.3331, 104.667],
  },
  {
    type: "happy_cultist",
    rotation: 315,
    wedge: [-10, -120, 172, 67.9999],
    icon: [0.923874, -57.2304, 85.9239, 26.7696],
    iconRotation: -315,
    shadow: [-91, -78.915, 90.9998, 109.085],
  },
];

function scene(value: number): number {
  return value * SCENE_SCALE;
}

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

function rectSize(rect: SceneRect) {
  return {
    width: scene(rect[2] - rect[0]),
    height: scene(rect[3] - rect[1]),
  };
}

function wedgeStyle(layout: (typeof REACTION_WHEEL_LAYOUT)[number], selected: boolean): CSSProperties {
  const radians = (layout.rotation * Math.PI) / 180;
  const lift = selected ? SELECTED_WEDGE_LIFT : 0;
  const liftX = Math.cos(radians) * lift;
  const liftY = Math.sin(radians) * lift;
  const { width, height } = rectSize(layout.wedge);

  return {
    height,
    left: scene(SCENE_CENTER + layout.wedge[0] + liftX),
    top: scene(SCENE_CENTER + layout.wedge[1] + liftY),
    transform: `rotate(${layout.rotation}deg)`,
    transformOrigin: "0 0",
    width,
  };
}

function childStyle(parent: SceneRect, child: SceneRect, rotation = 0): CSSProperties {
  const parentSize = rectSize(parent);
  return {
    height: scene(child[3] - child[1]),
    left: parentSize.width / 2 + scene(child[0]),
    top: parentSize.height / 2 + scene(child[1]),
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    transformOrigin: "0 0",
    width: scene(child[2] - child[0]),
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
  const [wheelOffset, setWheelOffset] = useState({ left: -96, top: -202 });

  const pending = !authReady || loading || authPending;
  const blocked = unavailable;
  const disabled = pending || blocked || (!userId && !ensureUser);
  const triggerReaction = storyReactionByType(selectedReaction ?? DEFAULT_STORY_REACTION);
  const activeWheelReaction = hoveredReaction ?? selectedReaction ?? null;
  const markerAngle = activeWheelReaction ? reactionAngle(activeWheelReaction) - 90 : -90;
  const triggerLabel = serviceLocale === "ko" ? "반응" : "Reaction";

  const updateWheelOffset = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const desiredLeft = (rect.width - WHEEL_SIZE) / 2;
    const viewportLeft = rect.left + desiredLeft;
    const clampedViewportLeft = Math.min(
      Math.max(VIEWPORT_MARGIN, viewportLeft),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - WHEEL_SIZE - VIEWPORT_MARGIN),
    );
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceAbove < WHEEL_SIZE && spaceBelow > spaceAbove
      ? rect.height + VIEWPORT_MARGIN
      : -202;

    setWheelOffset({
      left: desiredLeft + (clampedViewportLeft - viewportLeft),
      top,
    });
  }, []);

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
    updateWheelOffset();
    setOpen((value) => !value);
    setHoveredReaction(null);
  };

  const handleTriggerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" || disabled) return;
    event.preventDefault();
    ignoreNextClickRef.current = true;
    updateWheelOffset();
    setOpen(true);
    setDragging(true);
    setHoveredReaction(null);
  };

  const renderedReactions = useMemo(
    () => REACTION_WHEEL_LAYOUT.map((layout) => {
      const reaction = storyReactionByType(layout.type);
      const selected = activeWheelReaction === reaction.type;
      const label = serviceLocale === "ko" ? reaction.labelKo : reaction.labelEn;
      const count = counts[reaction.type] ?? 0;
      const wedgeSize = rectSize(layout.wedge);
      const iconStyle = childStyle(layout.wedge, layout.icon, layout.iconRotation);
      const shadowStyle = childStyle(layout.wedge, layout.shadow);

      return (
        <button
          key={reaction.type}
          type="button"
          aria-label={count > 0 ? `${label} ${count}` : label}
          className={cn(
            "absolute border-0 bg-transparent p-0 transition-[left,top,opacity] duration-75 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70",
          )}
          style={wedgeStyle(layout, selected)}
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
            width={Math.round(wedgeSize.width)}
            height={Math.round(wedgeSize.height)}
            aria-hidden
            className="absolute object-contain opacity-40"
            style={shadowStyle}
          />
          <Image
            src={WEDGE_ASSET}
            alt=""
            width={Math.round(wedgeSize.width)}
            height={Math.round(wedgeSize.height)}
            aria-hidden
            className={cn("absolute inset-0 h-full w-full object-contain transition-opacity", selected ? "opacity-75" : "opacity-35")}
          />
          <Image
            src={reaction.asset}
            alt=""
            width={Math.round(Number(iconStyle.width))}
            height={Math.round(Number(iconStyle.height))}
            aria-hidden
            className="absolute object-contain drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]"
            style={iconStyle}
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
          className="absolute z-50 touch-none select-none"
          style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, left: wheelOffset.left, top: wheelOffset.top }}
          onPointerMove={(event) => setHoveredReaction(reactionFromPoint(rootRef.current, event.clientX, event.clientY))}
          onPointerLeave={() => {
            if (!dragging) setHoveredReaction(null);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="absolute inset-0 rounded-full bg-black/55" />
          {renderedReactions}
          <Image
            src={MARKER_ASSET}
            alt=""
            width={Math.round(scene(48))}
            height={Math.round(scene(48))}
            aria-hidden
            className="pointer-events-none absolute object-contain opacity-95"
            style={{
              height: scene(48),
              left: scene(SCENE_CENTER - 24),
              top: scene(SCENE_CENTER - 24),
              transform: `rotate(${markerAngle}deg)`,
              transformOrigin: `${scene(24)}px ${scene(24)}px`,
              width: scene(48),
            }}
          />
        </div>
      )}
    </div>
  );
}
