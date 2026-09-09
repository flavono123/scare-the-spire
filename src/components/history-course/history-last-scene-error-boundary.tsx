"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export class HistoryLastSceneErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[history-course] last scene failed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          className="pointer-events-none absolute inset-0 bg-black"
          data-history-last-scene-error=""
        />
      );
    }
    return this.props.children;
  }
}
