import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProdRunSummary {
  id: string;
  seed: string;
  build: string;
  character: string;
  ascension: number;
  win: boolean;
  start_time: number | null;
  run_time: number | null;
  acts_count: number;
  total_floors: number;
  created_at: string;
}

function notFoundResponse() {
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}

/** The latest 100 production runs, from the production D1. */
export async function GET() {
  if (!devToolsEnabled()) {
    return notFoundResponse();
  }

  const [{ adminDeps }, { listProductionRuns }] = await Promise.all([
    import("../../../../../scripts/admin/admin-deps"),
    import("../../../../../scripts/admin/admin-reads"),
  ]);

  try {
    const { runs, count } = await listProductionRuns(adminDeps().d1("production"));
    return NextResponse.json({
      runs: runs as unknown as ProdRunSummary[],
      count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
