import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = {
  title: "짜퍼 후보 — DEV",
  description: "개발 전용: 짜퍼에 넣을 미니 게임 후보 플레이테스트 목록",
  robots: { index: false, follow: false },
};

/** Candidate minigames for 짜퍼, each a dev-only route under this one. */
const CANDIDATES = [
  {
    href: "/dev/vexing-puzzlebox/blank-card",
    title: "빈 카드",
    summary: "아트와 이름이 빈 카드 타일을 문구 시도와 힌트로 채워 정답 카드를 맞힌다.",
    icon: "/images/sts2/relics/vexing_puzzlebox.webp",
  },
];

export default function DevVexingPuzzleboxPage() {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this page.
  if (process.env.DEV_TOOLS_BUILD !== "1") notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold">짜퍼 후보</h1>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {CANDIDATES.map((candidate) => (
          <li key={candidate.href}>
            <Link
              href={candidate.href}
              className="flex h-full gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 p-4 hover:border-amber-400/70"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={candidate.icon} alt="" className="h-12 w-12 shrink-0 object-contain" />
              <span>
                <span className="block font-bold">{candidate.title}</span>
                <span className="mt-1 block text-sm text-zinc-400">{candidate.summary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
