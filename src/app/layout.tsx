import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  title: {
    default: "슬서운 이야기",
    template: "%s — 슬서운 이야기",
  },
  description: "슬레이 더 스파이어 2 패치노트, 백과사전, 커뮤니티",
  metadataBase: new URL("https://scare-the-spire.vercel.app"),
  openGraph: {
    title: "슬서운 이야기",
    description: "슬레이 더 스파이어 2 패치노트, 백과사전, 커뮤니티",
    siteName: "슬서운 이야기",
    images: [
      {
        url: "/images/sts2/cards/tag_team.webp",
        width: 1000,
        height: 760,
        alt: "슬서운 이야기 — 협력",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "슬서운 이야기",
    description: "슬레이 더 스파이어 2 패치노트, 백과사전, 커뮤니티",
    images: ["/images/sts2/cards/tag_team.webp"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/site.webmanifest",
  other: {
    "theme-color": "#1a1a2e",
  },
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
        <SpeedInsights />
      </body>
    </html>
  );
}
