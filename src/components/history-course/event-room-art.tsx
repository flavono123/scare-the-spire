"use client";

import type { CSSProperties, ReactNode } from "react";

const EVENT_PORTRAIT_RECT_WIDTH = 2560;
const EVENT_PORTRAIT_RECT_HEIGHT = 1200;
const EVENT_GAME_VIEWPORT_WIDTH = 1920;
const EVENT_GAME_VIEWPORT_HEIGHT = 1080;
const EVENT_PORTRAIT_SCALE = 1.04;
// Source: default_event_layout.tscn. Same offsets as event-detail GameViewportEventArt.
const EVENT_PORTRAIT_CENTER_Y = 5;

const EVENT_GAME_VIEWPORT_PORTRAIT_STYLE: CSSProperties = {
  height: `${(EVENT_PORTRAIT_RECT_HEIGHT / EVENT_GAME_VIEWPORT_HEIGHT) * 100}%`,
  left: "50%",
  top: `calc(50% + ${(EVENT_PORTRAIT_CENTER_Y / EVENT_GAME_VIEWPORT_HEIGHT) * 100}%)`,
  transform: `translate(-50%, -50%) scale(${EVENT_PORTRAIT_SCALE})`,
  transformOrigin: "center",
  width: `${(EVENT_PORTRAIT_RECT_WIDTH / EVENT_GAME_VIEWPORT_WIDTH) * 100}%`,
};

export function EventRoomArt({
  src,
  name,
  portrait,
  viewportOverlay,
  children,
}: {
  src: string;
  name: string;
  portrait?: ReactNode;
  viewportOverlay?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div className="absolute left-1/2 top-1/2 aspect-video h-full min-w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden">
        <div className="absolute" style={EVENT_GAME_VIEWPORT_PORTRAIT_STYLE}>
          {portrait ?? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={name} className="absolute inset-0 h-full w-full object-contain" />
          )}
        </div>
        {viewportOverlay}
      </div>
      <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/30 to-transparent" />
      {children}
    </div>
  );
}
