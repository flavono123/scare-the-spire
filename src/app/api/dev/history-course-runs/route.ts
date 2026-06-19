import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRODUCTION_RUN_ENV = "production";
const ROW_LIMIT = 100;

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

export async function GET() {
  if (!devToolsEnabled()) {
    return notFoundResponse();
  }

  const [{ supabase, supabaseEnabled }, { withSupabaseTimeout }] = await Promise.all([
    import("@/lib/supabase"),
    import("@/lib/supabase-timeout"),
  ]);

  if (!supabaseEnabled) {
    return NextResponse.json(
      { message: "Supabase is not configured." },
      { status: 503 },
    );
  }

  try {
    const { data, error, count } = await withSupabaseTimeout(
      "dev.history-course-runs.list",
      supabase
        .from("runs")
        .select(
          "id, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, created_at",
          { count: "exact" },
        )
        .eq("env", PRODUCTION_RUN_ENV)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
    );

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      runs: (data ?? []) as ProdRunSummary[],
      count: count ?? undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
