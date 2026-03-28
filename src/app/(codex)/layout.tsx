import type { Metadata } from "next";
import localFont from "next/font/local";

// Actual STS2 game fonts extracted from PCK
const spectral = localFont({
  src: "../../../public/fonts/spectral_bold.ttf",
  variable: "--font-spectral",
  weight: "700",
});

const kreon = localFont({
  src: [
    { path: "../../../public/fonts/kreon_regular.ttf", weight: "400" },
    { path: "../../../public/fonts/kreon_bold.ttf", weight: "700" },
  ],
  variable: "--font-kreon",
});

const gcBatang = localFont({
  src: "../../../public/fonts/GyeonggiCheonnyeonBatangBold.ttf",
  variable: "--font-gc-batang",
  weight: "700",
});

export const metadata: Metadata = {
  title: "Spire Codex — 슬레이 더 스파이어 2 백과사전",
  description: "슬레이 더 스파이어 2 카드, 유물, 포션, 에인션트 백과사전",
};

export default function CodexLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${spectral.variable} ${kreon.variable} ${gcBatang.variable}`}>
      {children}
    </div>
  );
}
