import fs from "fs/promises";
import path from "path";
import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "게임 레퍼런스 — DEV",
  description: "개발 전용: 승천, 모디파이어, 키워드, 고난, 의도, 막 데이터",
};

const DATA_DIR = path.join(process.cwd(), "data/spire-codex");

async function readJson<T>(relPath: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, relPath), "utf-8");
  return JSON.parse(raw) as T;
}

interface Ascension {
  id: string;
  level: number;
  name: string;
  description: string;
}

interface Modifier {
  id: string;
  name: string;
  description: string;
}

interface Keyword {
  id: string;
  name: string;
  description: string;
}

interface Affliction {
  id: string;
  name: string;
  description: string;
  extra_card_text: string | null;
  is_stackable: boolean;
}

interface Intent {
  id: string;
  name: string;
  description: string;
}

interface Act {
  id: string;
  name: string;
  num_rooms: number;
  bosses: string[];
  ancients: string[];
}

export default async function ReferencePage() {
  const [ascKor, ascEng, modKor, modEng, kwKor, kwEng, affKor, affEng, intKor, intEng, actKor, actEng] =
    await Promise.all([
      readJson<Ascension[]>("kor/ascensions.json"),
      readJson<Ascension[]>("eng/ascensions.json"),
      readJson<Modifier[]>("kor/modifiers.json"),
      readJson<Modifier[]>("eng/modifiers.json"),
      readJson<Keyword[]>("kor/keywords.json"),
      readJson<Keyword[]>("eng/keywords.json"),
      readJson<Affliction[]>("kor/afflictions.json"),
      readJson<Affliction[]>("eng/afflictions.json"),
      readJson<Intent[]>("kor/intents.json"),
      readJson<Intent[]>("eng/intents.json"),
      readJson<Act[]>("kor/acts.json"),
      readJson<Act[]>("eng/acts.json"),
    ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* DEV ONLY banner */}
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          개발 환경 전용 레퍼런스 — 패치노트 번역 시 게임 내 공식 용어 참조용
        </span>
      </div>

      <h1 className="text-2xl font-bold text-amber-400">게임 레퍼런스</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        승천, 모디파이어, 키워드, 고난, 의도, 막 — 게임 내 공식 한국어 번역 대조표
      </p>

      {/* ═══════ Ascensions ═══════ */}
      <Section title="승천 (Ascension)" count={ascKor.length} color="text-red-400">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 w-12">Lv</th>
              <th className="py-1 pr-2">한국어</th>
              <th className="py-1 pr-2">English</th>
              <th className="py-1">설명</th>
            </tr>
          </thead>
          <tbody>
            {ascKor.map((a, i) => (
              <tr key={a.id} className="border-b border-border/50">
                <td className="py-1.5 pr-2 text-muted-foreground">{a.level}</td>
                <td className="py-1.5 pr-2 font-medium text-red-400">{a.name}</td>
                <td className="py-1.5 pr-2 text-muted-foreground">{ascEng[i]?.name}</td>
                <td className="py-1.5 text-muted-foreground">
                  <RichText text={a.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══════ Modifiers ═══════ */}
      <Section title="모디파이어 (Modifier)" count={modKor.length} color="text-orange-400">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2">ID</th>
              <th className="py-1 pr-2">한국어</th>
              <th className="py-1 pr-2">English</th>
              <th className="py-1">설명</th>
            </tr>
          </thead>
          <tbody>
            {modKor.map((m, i) => (
              <tr key={m.id} className="border-b border-border/50">
                <td className="py-1.5 pr-2">
                  <code className="text-[10px] text-muted-foreground/50">{m.id}</code>
                </td>
                <td className="py-1.5 pr-2 font-medium text-orange-400">{m.name}</td>
                <td className="py-1.5 pr-2 text-muted-foreground">{modEng[i]?.name}</td>
                <td className="py-1.5 text-muted-foreground">
                  <RichText text={m.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══════ Keywords ═══════ */}
      <Section title="키워드 (Keyword)" count={kwKor.length} color="text-cyan-400">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2">ID</th>
              <th className="py-1 pr-2">한국어</th>
              <th className="py-1 pr-2">English</th>
              <th className="py-1">설명</th>
            </tr>
          </thead>
          <tbody>
            {kwKor.map((k, i) => (
              <tr key={k.id} className="border-b border-border/50">
                <td className="py-1.5 pr-2">
                  <code className="text-[10px] text-muted-foreground/50">{k.id}</code>
                </td>
                <td className="py-1.5 pr-2 font-medium text-cyan-400">{k.name}</td>
                <td className="py-1.5 pr-2 text-muted-foreground">{kwEng[i]?.name}</td>
                <td className="py-1.5 text-muted-foreground">
                  <RichText text={k.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══════ Afflictions ═══════ */}
      <Section title="고난 (Affliction)" count={affKor.length} color="text-purple-400">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2">ID</th>
              <th className="py-1 pr-2">한국어</th>
              <th className="py-1 pr-2">English</th>
              <th className="py-1">설명</th>
            </tr>
          </thead>
          <tbody>
            {affKor.map((a, i) => (
              <tr key={a.id} className="border-b border-border/50">
                <td className="py-1.5 pr-2">
                  <code className="text-[10px] text-muted-foreground/50">{a.id}</code>
                </td>
                <td className="py-1.5 pr-2 font-medium text-purple-400">
                  {a.name}
                  {a.is_stackable && (
                    <span className="ml-1 text-[9px] text-amber-400">★</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-muted-foreground">{affEng[i]?.name}</td>
                <td className="py-1.5 text-muted-foreground">
                  <RichText text={a.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══════ Intents ═══════ */}
      <Section title="의도 (Intent)" count={intKor.length} color="text-rose-400">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2">ID</th>
              <th className="py-1 pr-2">한국어</th>
              <th className="py-1 pr-2">English</th>
              <th className="py-1">설명</th>
            </tr>
          </thead>
          <tbody>
            {intKor.map((intent, i) => (
              <tr key={intent.id} className="border-b border-border/50">
                <td className="py-1.5 pr-2">
                  <code className="text-[10px] text-muted-foreground/50">{intent.id}</code>
                </td>
                <td className="py-1.5 pr-2 font-medium text-rose-400">{intent.name}</td>
                <td className="py-1.5 pr-2 text-muted-foreground">{intEng[i]?.name}</td>
                <td className="py-1.5 text-muted-foreground">
                  <RichText text={intent.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══════ Acts ═══════ */}
      <Section title="막 (Act)" count={actKor.length} color="text-green-400">
        <div className="grid gap-4 sm:grid-cols-2">
          {actKor.map((act, i) => (
            <div
              key={act.id}
              className="rounded-lg border border-green-500/20 bg-card/50 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-green-400">{act.name}</h3>
                <span className="text-xs text-muted-foreground">{actEng[i]?.name}</span>
              </div>
              <code className="mt-0.5 block text-[10px] text-muted-foreground/50">
                {act.id}
              </code>
              <div className="mt-2 text-xs text-muted-foreground">
                {act.num_rooms}개 방 · 보스 {act.bosses.length}종 · 고대의 존재{" "}
                {new Set(act.ancients).size}종
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="mt-8 mb-12 text-center text-xs text-muted-foreground/40">
        spire-codex 데이터 기반 · 패치노트 번역 시 이 페이지의 공식 용어를 사용할 것
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className={`text-lg font-bold ${color}`}>
        {title}{" "}
        <span className="text-sm font-normal text-muted-foreground">({count})</span>
      </h2>
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}
