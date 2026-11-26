import fs from "fs/promises";
import path from "path";
import Link from "next/link";

const DATA_DIR = path.join(process.cwd(), "data/sts2");

type GoldTips = Record<string, Record<string, string | string[] | null>>;

/** Every gold word of game text that the game attaches no tip to (scripts/generate-game-tips.py), grouped by word. */
export default async function GoldWordsDevPage({ locale }: { locale: string }) {
  const locales = (await fs.readdir(path.join(DATA_DIR, "gold-tips"))).map((file) => file.replace(/\.json$/, "")).sort();
  const current = locales.includes(locale) ? locale : "kor";
  const goldTips = JSON.parse(await fs.readFile(path.join(DATA_DIR, "gold-tips", `${current}.json`), "utf-8")) as GoldTips;

  const gameTips = JSON.parse(await fs.readFile(path.join(DATA_DIR, "game-tips.json"), "utf-8")) as {
    runtime: { element: string; reason: string }[];
  };
  const byWord = new Map<string, string[]>();
  const multi = new Map<string, { tips: string[]; elements: string[] }>();
  let withTip = 0;
  for (const [element, words] of Object.entries(goldTips)) {
    for (const [word, tip] of Object.entries(words)) {
      if (Array.isArray(tip)) {
        const entry = multi.get(word) ?? { tips: tip, elements: [] };
        entry.elements.push(element);
        multi.set(word, entry);
      }
      if (tip) {
        withTip += 1;
        continue;
      }
      byWord.set(word, [...(byWord.get(word) ?? []), element]);
    }
  }
  const rows = [...byWord.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ko"));
  const without = rows.reduce((sum, [, elements]) => sum + elements.length, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-sm">
      <h1 className="text-xl font-bold">팁 없는 금색 단어</h1>
      <p className="mt-2 text-muted-foreground">
        게임 문구에서 금색이지만 그 요소의 게임 팁 목록에 맞는 팁이 없는 단어입니다. 사이트는 금색 강조만 합니다.
        출처: <code>data/sts2/gold-tips/{current}.json</code> (<code>scripts/generate-game-tips.py</code>).
      </p>
      <nav className="mt-4 flex flex-wrap gap-2">
        {locales.map((code) => (
          <Link
            key={code}
            href={`/dev/gold-words?locale=${code}`}
            className={code === current ? "rounded bg-primary px-2 py-0.5 text-primary-foreground" : "rounded border px-2 py-0.5"}
          >
            {code}
          </Link>
        ))}
      </nav>
      <p className="mt-4">
        {current}: 팁 있음 {withTip} · 팁 없음 {without} (단어 {rows.length}개)
      </p>
      <h2 className="mt-6 text-base font-bold">한 단어가 여러 팁을 띄움</h2>
      <p className="mt-1 text-muted-foreground">여러 팁 이름이 공통으로 가진 단어입니다. 호버하면 모두 뜹니다.</p>
      <ul className="mt-2 space-y-1">
        {[...multi.entries()].map(([word, { tips, elements }]) => (
          <li key={word}>
            <span className="font-game-text spire-gold font-semibold">{word}</span> → <code>{tips.join(", ")}</code>{" "}
            <span className="font-mono text-xs text-muted-foreground">({elements.join(", ")})</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-base font-bold">실행 중에 정해지는 팁 (예외)</h2>
      <p className="mt-1 text-muted-foreground">게임이 런 상황에 따라 팁 목록을 만드는 요소입니다. 백과사전은 런 밖의 목록을 씁니다.</p>
      <ul className="mt-2 space-y-1 font-mono text-xs">
        {gameTips.runtime.map(({ element, reason }) => (
          <li key={element}>{element}: {reason}</li>
        ))}
      </ul>
      <h2 className="mt-6 text-base font-bold">팁 없음</h2>
      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1 pr-4">단어</th>
            <th className="py-1 pr-4">요소 수</th>
            <th className="py-1">요소</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([word, elements]) => (
            <tr key={word} className="border-b align-top">
              <td className="py-1 pr-4 font-game-text spire-gold font-semibold whitespace-nowrap">{word}</td>
              <td className="py-1 pr-4">{elements.length}</td>
              <td className="py-1 font-mono text-xs text-muted-foreground">{elements.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
