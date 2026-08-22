import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { CloudflareWebAnalytics } from "@/components/cloudflare-web-analytics";
import { ColorSchemeScript } from "@/components/color-scheme-script";
import { LocaleDocumentAttributes } from "@/components/locale-document-attributes";
import { SiteNavbar } from "@/components/site-navbar";
import { GamePageScroll } from "@/components/game-page-scroll";
import { ColorSchemeDocumentAttributes } from "@/hooks/use-color-scheme";
import { getDefaultServiceMetadata } from "@/lib/service-metadata";
import { SITE_METADATA_BASE } from "@/lib/site-origin";
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
  ...getDefaultServiceMetadata("ko"),
  metadataBase: SITE_METADATA_BASE,
  verification: {
    google: "E8V2Xb1wGY6BbJwDxVCVQ8NSoyOVoaghTCaSstAeVAA",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/site.webmanifest",
  other: {
    "theme-color": "#1a1a2e",
    "naver-site-verification": "3a4a92ed4d694d5e3e02163ac553ac6465ec4e5b",
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
      className={`${spectral.variable} ${kreon.variable} ${gcBatang.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ColorSchemeScript />
      </head>
      <body
        suppressHydrationWarning
        className="flex h-dvh flex-col overflow-hidden font-service antialiased bg-background text-foreground"
      >
        <ColorSchemeDocumentAttributes />
        <Suspense>
          <LocaleDocumentAttributes />
          <SiteNavbar />
        </Suspense>
        <GamePageScroll>
          {children}
        </GamePageScroll>
        <CloudflareWebAnalytics />
      </body>
    </html>
  );
}
