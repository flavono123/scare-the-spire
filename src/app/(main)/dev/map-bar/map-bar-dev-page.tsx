import Link from "next/link";
import { MAP_BAR_PRESETS } from "@/lib/map-bar/scenarios";
import { MapBarClient } from "./map-bar-client";
import { parseMapBarQuery, type SearchParams } from "./query-input";

export default function MapBarDevPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseMapBarQuery(searchParams);
  if (!query.input) return <MapBarUsage errors={query.errors} />;
  // The resolved start and orientation are part of the input, so window.__bar.input and frames.json name them.
  const input = { ...query.input, start: query.input.start ?? "before", orientation: query.input.orientation ?? "horizontal" } as const;
  return <MapBarClient input={input} preset={query.preset} options={query.options} />;
}

function MapBarUsage({ errors }: { errors: string[] }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 text-sm text-zinc-300">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">DEV / MAP BAR</p>
      <h1 className="text-xl font-bold text-zinc-100">맵 진행 바 시뮬레이터</h1>
      {errors.length > 0 && (
        <ul className="rounded border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
      <p>프리셋:</p>
      <ul className="list-disc pl-5">
        {Object.keys(MAP_BAR_PRESETS).map((name) => (
          <li key={name} className="flex gap-3">
            <Link className="text-sky-300 hover:underline" href={`/dev/map-bar?preset=${name}`}>{name}</Link>
            <Link className="text-sky-300 hover:underline" href={`/dev/map-bar?preset=${name}&orientation=vertical`}>세로</Link>
          </li>
        ))}
      </ul>
      <p>
        입력 예: <code className="text-amber-200">?nodes=ancient,unknown:monster,unknown:chest,unknown&amp;orientation=vertical&amp;arrivals=,1500,4000</code>
        {" "}— 자세한 키는 docs/MAP_BAR.md.
      </p>
    </main>
  );
}
