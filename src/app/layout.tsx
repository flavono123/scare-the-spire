import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LocaleDocumentAttributes } from "@/components/locale-document-attributes";
import { SiteNavbar } from "@/components/site-navbar";
import { DEFAULT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
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
  src: "../../public/fonts/GyeonggiCheonnyeonBatangBold.woff2",
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
    images: [DEFAULT_PAGE_OG_IMAGE],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "슬서운 이야기",
    description: "슬레이 더 스파이어 2 패치노트, 백과사전, 커뮤니티",
    images: [DEFAULT_PAGE_OG_IMAGE.url],
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
    <html
      lang="ko"
      data-service-locale="ko"
      data-game-locale="kor"
      className={`${spectral.variable} ${kreon.variable} ${gcBatang.variable} dark`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="font-service antialiased bg-background text-foreground"
      >
        <Suspense>
          <LocaleDocumentAttributes />
          <SiteNavbar />
        </Suspense>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
