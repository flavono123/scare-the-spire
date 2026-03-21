import type { Metadata } from "next";
import { Cinzel, Noto_Serif_KR } from "next/font/google";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const notoSerifKR = Noto_Serif_KR({
  variable: "--font-spire",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "카드 도서관 — Spire Codex",
  description: "슬레이 더 스파이어 2 카드 백과사전",
};

export default function CodexLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${cinzel.variable} ${notoSerifKR.variable}`}>{children}</div>;
}
