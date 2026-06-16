import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { CloudflareWebAnalytics } from "@/components/cloudflare-web-analytics";
import { LocaleDocumentAttributes } from "@/components/locale-document-attributes";
import { SiteNavbar } from "@/components/site-navbar";
import { getDefaultServiceMetadata } from "@/lib/service-metadata";
import { getSiteOrigin } from "@/lib/site-origin";
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
  metadataBase: new URL(getSiteOrigin()),
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
        <CloudflareWebAnalytics />
      </body>
    </html>
  );
}
