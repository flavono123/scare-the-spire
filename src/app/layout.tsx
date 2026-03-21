import type { Metadata } from "next";
import { Geist } from "next/font/google";
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
        {children}
      </body>
    </html>
  );
}
