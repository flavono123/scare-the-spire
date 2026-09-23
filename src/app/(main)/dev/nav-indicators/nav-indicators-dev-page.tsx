"use client";

import { useEffect, useState } from "react";
import { NavAttentionDot } from "@/components/nav-attention-dot";
import Image from "@/components/ui/static-image";
import { publishNavIndicators } from "@/hooks/use-nav-indicators";
import {
  NAV_INDICATOR_ENVS,
  NAV_INDICATORS_OFF,
  NAV_INDICATORS_TABLE,
  isMissingNavIndicatorsTable,
  isNavIndicatorEnv,
  navIndicatorFlagsFromRow,
  type NavIndicatorEnv,
  type NavIndicatorFlags,
  type NavIndicatorTarget,
} from "@/lib/nav-indicators";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { setNavIndicator } from "./actions";

const TARGETS: { target: NavIndicatorTarget; label: string; icon: string }[] = [
  {
    target: "patch_notes",
    label: "패치노트",
    icon: "/images/sts2/nav/patch_notes_icon.png",
  },
  {
    target: "toy_box",
    label: "장난감 상자",
    icon: "/images/sts2/relics/toy_box.webp",
  },
];

type RowState = Record<NavIndicatorEnv, NavIndicatorFlags>;

const EMPTY_ROWS: RowState = {
  production: NAV_INDICATORS_OFF,
  development: NAV_INDICATORS_OFF,
};

function flagFor(flags: NavIndicatorFlags, target: NavIndicatorTarget): boolean {
  return target === "patch_notes" ? flags.patchNotes : flags.toyBox;
}

export default function NavIndicatorsDevPage() {
  const [rows, setRows] = useState<RowState>(EMPTY_ROWS);
  const [loaded, setLoaded] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabaseEnabled) {
        if (!cancelled) {
          setError("Supabase 환경 변수가 없습니다.");
          setLoaded(true);
        }
        return;
      }

      try {
        const { data, error: queryError } = await withSupabaseTimeout(
          "dev.nav_indicators.select",
          supabase.from(NAV_INDICATORS_TABLE).select("env, patch_notes, toy_box"),
        );
        if (cancelled) return;
        if (queryError) {
          setError(isMissingNavIndicatorsTable(queryError)
            ? "nav_indicators 마이그레이션이 필요합니다."
            : queryError.message);
          setLoaded(true);
          return;
        }

        const next = { ...EMPTY_ROWS };
        for (const row of data ?? []) {
          if (!isNavIndicatorEnv(row.env)) continue;
          next[row.env] = navIndicatorFlagsFromRow(row);
        }
        setRows(next);
        if (isNavIndicatorEnv(supabaseEnv)) publishNavIndicators(next[supabaseEnv]);
        setLoaded(true);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Supabase 조회에 실패했습니다.");
        setLoaded(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(env: NavIndicatorEnv, target: NavIndicatorTarget) {
    const key = `${env}:${target}`;
    setPendingKey(key);
    setError(null);
    const enabled = !flagFor(rows[env], target);
    const result = await setNavIndicator({ env, target, enabled });
    setPendingKey(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows((current) => ({ ...current, [env]: result.flags }));
    if (env === supabaseEnv) publishNavIndicators(result.flags);
  }

  const activeEnv = isNavIndicatorEnv(supabaseEnv) ? supabaseEnv : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-service text-xl font-bold">상단바 인디케이터</h1>
        <p className="text-sm text-muted-foreground">
          패치노트와 장난감 상자 아이콘 오른쪽 위의 점을 켠다. 이 브라우저가 읽는 환경은{" "}
          <span className="font-semibold text-foreground">{supabaseEnv}</span>
          이다.
        </p>
      </header>

      {activeEnv && (
        <div className="flex items-center gap-4 rounded-md border border-border px-3 py-2">
          {TARGETS.map((item) => (
            <span key={item.target} className="relative inline-flex">
              <Image
                src={item.icon}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              {flagFor(rows[activeEnv], item.target) && <NavAttentionDot />}
            </span>
          ))}
          <span className="text-xs text-muted-foreground">현재 환경 미리보기</span>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      )}

      {NAV_INDICATOR_ENVS.map((env) => (
        <section key={env} className="flex flex-col gap-3 rounded-md border border-border p-4">
          <h2 className="font-service text-sm font-semibold">
            {env}
            {env === supabaseEnv && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">이 브라우저</span>
            )}
          </h2>
          {TARGETS.map((item) => {
            const enabled = flagFor(rows[env], item.target);
            const key = `${env}:${item.target}`;
            return (
              <div key={item.target} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <Image src={item.icon} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
                  {item.label}
                </span>
                <button
                  type="button"
                  disabled={!loaded || pendingKey !== null}
                  onClick={() => void toggle(env, item.target)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    enabled
                      ? "border-[#EFC851]/70 bg-[#EFC851]/15 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {pendingKey === key ? "저장 중" : enabled ? "켜짐" : "꺼짐"}
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}
