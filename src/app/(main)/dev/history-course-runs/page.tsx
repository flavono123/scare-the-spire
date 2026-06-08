import { notFound } from "next/navigation";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import HistoryCourseRunsDevPage, {
  type ProdRunSummary,
} from "./history-course-runs-dev-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "History Course Runs — DEV",
  description: "개발 전용 production 공유 런 테스트 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

const PRODUCTION_RUN_ENV = "production";
const ROW_LIMIT = 100;

interface QueryState {
  runs: ProdRunSummary[];
  count?: number;
  error?: string;
}

async function loadProductionRuns(): Promise<QueryState> {
  if (!supabaseEnabled) {
    return {
      runs: [],
      error: "NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.",
    };
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
      return { runs: [], error: error.message };
    }

    return {
      runs: (data ?? []) as ProdRunSummary[],
      count: count ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { runs: [], error: message };
  }
}

export default async function HistoryCourseRunsDevRoute() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const state = await loadProductionRuns();
  return (
    <HistoryCourseRunsDevPage
      runs={state.runs}
      count={state.count}
      error={state.error}
    />
  );
}
