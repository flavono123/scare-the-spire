import type { Metadata } from "next";
import { Suspense } from "react";
import { CloudflareWebAnalytics } from "@/components/cloudflare-web-analytics";
import { ColorSchemeScript } from "@/components/color-scheme-script";
import { LocaleDocumentAttributes } from "@/components/locale-document-attributes";
import { CommentCourier } from "@/components/comment-courier";
import { SiteNavbar } from "@/components/site-navbar";
import { ColorSchemeDocumentAttributes } from "@/hooks/use-color-scheme";
import { getDefaultServiceMetadata } from "@/lib/service-metadata";
import { SITE_METADATA_BASE } from "@/lib/site-origin";
import "./globals.css";

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
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          href="/fonts/GyeonggiCheonnyeonBatangBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/spectral_bold.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/kreon_regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/kreon_bold.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <ColorSchemeScript />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-dvh font-service antialiased bg-background text-foreground"
      >
        <ColorSchemeDocumentAttributes />
        <Suspense>
          <LocaleDocumentAttributes />
          <SiteNavbar />
        </Suspense>
        {children}
        <CommentCourier />
        <div
          id="hover-tip-root"
          className="pointer-events-none fixed inset-0 z-[10050] overflow-visible"
        />
        <CloudflareWebAnalytics />
      </body>
    </html>
  );
}
