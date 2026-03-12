"use client";

import { BudgetAlert } from "@/lib/api";
import { money } from "@/lib/format";

const STATUS_CONFIG = {
  safe: {
    label: "OK",
    badge: "🟢",
    barColor: "bg-green-500",
    textColor: "text-green-400",
    borderColor: "border-green-500/20",
    glowColor: "rgba(34,197,94,0.1)",
  },
  warning: {
    label: "Attention",
    badge: "🟡",
    barColor: "bg-yellow-500",
    textColor: "text-yellow-400",
    borderColor: "border-yellow-500/20",
    glowColor: "rgba(234,179,8,0.1)",
  },
  danger: {
    label: "Critique",
    badge: "🟠",
    barColor: "bg-orange-500",
    textColor: "text-orange-400",
    borderColor: "border-orange-500/20",
    glowColor: "rgba(249,115,22,0.1)",
  },
  exceeded: {
    label: "Dépassé",
    badge: "🔴",
    barColor: "bg-red-500",
    textColor: "text-red-400",
    borderColor: "border-red-500/20",
    glowColor: "rgba(239,68,68,0.1)",
  },
} as const;

interface Props {
  alert: BudgetAlert;
}

export default function BudgetAlertCard({ alert }: Props) {
  const status = alert.status ?? "safe";
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.safe;
  const pct = alert.percentage ?? 0;
  const clampedPct = Math.min(pct, 100);

  return (
    <div
      className={`rounded-3xl bg-black/40 backdrop-blur-md border p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:brightness-110 ${cfg.borderColor}`}
      style={{ boxShadow: `0 0 30px ${cfg.glowColor}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white/90 text-base leading-tight">{alert.category_name}</h3>
          <p className="text-xs text-white/50 mt-0.5">
            {money(alert.spent ?? 0)} <span className="text-white/30">/</span> {money(alert.budget_limit ?? alert.monthly_limit)}
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-black/30 border ${cfg.borderColor} ${cfg.textColor} whitespace-nowrap`}
        >
          {cfg.badge} {cfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-white/50 mb-1.5">
          <span>{pct.toFixed(1)}% utilisé</span>
          <span className={(alert.remaining ?? 0) < 0 ? "text-red-400" : "text-white/50"}>
            {(alert.remaining ?? 0) >= 0 ? `${money(alert.remaining ?? 0)} restant` : `${money(Math.abs(alert.remaining ?? 0))} dépassé`}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`}
            style={{ width: `${clampedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
