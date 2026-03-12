"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getBudgetAlertsFull as getBudgetAlerts, BudgetAlert, BudgetAlertResponse } from "@/lib/api";
import BudgetAlertCard from "@/components/BudgetAlertCard";
import { money } from "@/lib/format";

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const style =
    tone === "good"
      ? { borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", boxShadow: "0 0 30px rgba(34,197,94,0.08)" }
      : tone === "bad"
      ? { borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", boxShadow: "0 0 30px rgba(239,68,68,0.08)" }
      : tone === "warn"
      ? { borderColor: "rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.08)", boxShadow: "0 0 30px rgba(234,179,8,0.08)" }
      : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" };

  return (
    <div
      className="rounded-3xl p-6 border backdrop-blur-md transition-all duration-300 hover:-translate-y-1"
      style={style as React.CSSProperties}
    >
      <div className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-2 tracking-tight text-white">{value}</div>
    </div>
  );
}

function getMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
}

/** Threshold below which remaining budget triggers a warning (10% of total budget) */
const REMAINING_WARNING_THRESHOLD = 0.1;

/** Returns the tone for the "spent" summary card based on how much was consumed */
function getSpentTone(spent: number, budget: number): "good" | "warn" | "bad" {
  if (spent > budget) return "bad";
  const ratio = budget > 0 ? spent / budget : 0;
  return ratio > 0.7 ? "warn" : "good";
}

/** Returns the tone for the "remaining" summary card */
function getRemainingTone(remaining: number, totalBudget: number): "good" | "warn" | "bad" {
  if (remaining < 0) return "bad";
  if (remaining < totalBudget * REMAINING_WARNING_THRESHOLD) return "warn";
  return "good";
}

export default function BudgetPage() {
  const [data, setData] = useState<BudgetAlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getBudgetAlerts();
      setData(result);
    } catch {
      setError("Erreur lors du chargement des budgets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alertCount = data
    ? data.alerts.filter((a: BudgetAlert) => a.status !== "safe").length
    : 0;
  const remaining = data ? data.total_budget - data.total_spent : 0;

  return (
    <main className="mb-container py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">💰 Suivi des Budgets</h1>
          <p className="text-white/50 mt-1 text-sm">
            {data ? getMonthLabel(data.month ?? new Date().toISOString().slice(0, 7)) : "Chargement…"}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Actualiser
        </button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Budgété" value={money(data.total_budget)} tone="neutral" />
          <SummaryCard
            label="Total Dépensé"
            value={money(data.total_spent)}
            tone={getSpentTone(data.total_spent, data.total_budget)}
          />
          <SummaryCard
            label="Restant"
            value={money(remaining)}
            tone={getRemainingTone(remaining, data.total_budget)}
          />
          <SummaryCard
            label="Catégories en alerte"
            value={String(alertCount)}
            tone={alertCount === 0 ? "good" : alertCount <= 2 ? "warn" : "bad"}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 text-white/40">
            <div className="w-10 h-10 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm">Chargement des budgets…</span>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-3xl bg-red-500/10 border border-red-500/20 p-6 text-center text-red-300">
          <p className="text-sm">{error}</p>
          <button onClick={load} className="mt-3 text-xs underline opacity-70 hover:opacity-100">
            Réessayer
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.alerts.length === 0 && (
        <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-12 flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">💡</span>
          <h2 className="text-xl font-semibold text-white/80">Aucun budget configuré</h2>
          <p className="text-sm text-white/40 max-w-sm">
            Définissez des limites de budget sur vos catégories pour suivre vos dépenses ici.
          </p>
          <Link
            href="/categories"
            className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-all"
          >
            Configurer les catégories →
          </Link>
        </div>
      )}

      {/* Budget cards grid */}
      {!loading && !error && data && data.alerts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.alerts.map((alert: BudgetAlert) => (
            <BudgetAlertCard key={alert.category_id} alert={alert} />
          ))}
        </div>
      )}
    </main>
  );
}
