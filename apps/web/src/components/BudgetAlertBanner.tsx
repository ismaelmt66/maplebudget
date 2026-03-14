"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBudgetSummary, BudgetSummary } from "@/lib/api";

export default function BudgetAlertBanner() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);

  useEffect(() => {
    getBudgetSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  if (!summary) return null;

  const alertCount = summary.over_budget_count + summary.warning_count;
  if (alertCount === 0) return null;

  const hasExceeded = summary.over_budget_count > 0;

  return (
    <Link
      href="/finances/budget"
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:brightness-110 ${
        hasExceeded
          ? "bg-red-500/10 border-red-500/20 text-red-300"
          : "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
      }`}
    >
      <span className="text-xl">{hasExceeded ? "🔴" : "🟡"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">
          {hasExceeded
            ? `${summary.over_budget_count} catégorie${summary.over_budget_count > 1 ? "s" : ""} dépassée${summary.over_budget_count > 1 ? "s" : ""}`
            : `${summary.warning_count} catégorie${summary.warning_count > 1 ? "s" : ""} en alerte`}
        </p>
        <p className="text-xs opacity-70 mt-0.5 truncate">
          {summary.warning_count > 0 && summary.over_budget_count > 0
            ? `${summary.over_budget_count} dépassée${summary.over_budget_count > 1 ? "s" : ""}, ${summary.warning_count} en alerte — voir les budgets`
            : "Cliquez pour voir les détails"}
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 flex-shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
