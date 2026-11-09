import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";
import { parseRunRouteSlug } from "@/lib/sts2-run-hash";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProdRunRow {
  id: string;
  raw: string;
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

/** One production run with its raw, from the production D1. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!devToolsEnabled()) {
    return notFoundResponse();
  }

  const { runId } = await params;
  if (!parseRunRouteSlug(runId)) {
    return NextResponse.json({ message: "Invalid runId" }, { status: 400 });
  }

  const [{ adminDeps }, { readProductionRun }] = await Promise.all([
    import("../../../../../../scripts/admin/admin-deps"),
    import("../../../../../../scripts/admin/admin-reads"),
  ]);

  try {
    const run = await readProductionRun(adminDeps().d1("production"), runId);
    if (!run) return notFoundResponse();

    return NextResponse.json({ run: run as unknown as ProdRunRow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
