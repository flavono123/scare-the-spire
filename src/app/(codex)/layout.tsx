import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "카드 도서관 — Spire Codex",
  description: "슬레이 더 스파이어 2 카드 백과사전",
};

export default function CodexLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
