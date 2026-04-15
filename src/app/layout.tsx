import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { SiteNavbar } from "@/components/site-navbar";
import "./globals.css";

// STS2 game fonts extracted from PCK
const spectral = localFont({
  src: "../../public/fonts/spectral_bold.ttf",
  variable: "--font-spectral",
  weight: "700",
});

const kreon = localFont({
  src: [
    { path: "../../public/fonts/kreon_regular.ttf", weight: "400" },
    { path: "../../public/fonts/kreon_bold.ttf", weight: "700" },
  ],
  variable: "--font-kreon",
});

const gcBatang = localFont({
  src: "../../public/fonts/GyeonggiCheonnyeonBatangBold.ttf",
  variable: "--font-gc-batang",
  weight: "700",
});

export const metadata: Metadata = {
  title: "슬서운 이야기",
  description: "슬레이 더 스파이어 밸런스 변경 이력",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${spectral.variable} ${kreon.variable} ${gcBatang.variable} font-sans antialiased bg-background text-foreground`}
      >
        <SiteNavbar />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
