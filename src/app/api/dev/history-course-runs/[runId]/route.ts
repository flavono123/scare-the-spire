import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";
import { parseRunRouteSlug } from "@/lib/sts2-run-hash";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRODUCTION_RUN_ENV = "production";

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
    const { data, error } = await withSupabaseTimeout(
      "dev.history-course-runs.detail",
      supabase
        .from("runs")
        .select(
          "id, raw, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, created_at",
        )
        .eq("env", PRODUCTION_RUN_ENV)
        .eq("id", runId)
        .maybeSingle(),
    );

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    if (!data) return notFoundResponse();

    return NextResponse.json({ run: data as ProdRunRow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
