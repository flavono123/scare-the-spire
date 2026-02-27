import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "슬서운 이야기",
  description: "슬레이 더 스파이어 밸런스 변경 이력",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="dark">
      <body className={`${geist.variable} antialiased bg-background text-foreground`}>
        <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl flex items-center justify-between px-4 h-12">
            <Link href="/" className="text-base font-bold text-yellow-500">
              슬서운 이야기
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                이야기
              </Link>
              <Link
                href="/cards"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                카드
              </Link>
              <Link
                href="/relics"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                유물
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
