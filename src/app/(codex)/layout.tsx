import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "백과사전 — 슬서운 이야기",
  description: "슬레이 더 스파이어 2 카드, 유물, 포션, 에인션트 백과사전",
};

export default function CodexLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
