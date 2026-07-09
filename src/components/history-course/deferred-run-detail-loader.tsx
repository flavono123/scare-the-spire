"use client";

import dynamic from "next/dynamic";
import type { RunDetailLoaderProps } from "@/components/history-course/run-detail-loader";

const RunDetailLoader = dynamic<RunDetailLoaderProps>(
  () => import("@/components/history-course/run-detail-loader").then((mod) => mod.RunDetailLoader),
  { ssr: false },
);

export function DeferredRunDetailLoader(props: RunDetailLoaderProps) {
  return <RunDetailLoader {...props} />;
}
