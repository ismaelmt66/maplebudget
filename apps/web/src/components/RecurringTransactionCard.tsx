"use client";

import React from "react";
import { RecurringTransaction } from "@/lib/api";
import { money } from "@/lib/format";

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  biweekly: "Bimensuel",
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

const FREQUENCY_COLORS: Record<string, string> = {
  daily: "bg-red-500/20 text-red-300 border-red-500/30",
  weekly: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  biweekly: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  monthly: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  quarterly: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  yearly: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const STATUS_BADGE: Record<string, { label: string; icon: string; className: string }> = {
  active: { label: "Actif", icon: "🟢", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" },
  paused: { label: "Pausé", icon: "🟡", className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20" },
  ended: { label: "Terminé", icon: "🔴", className: "bg-red-500/15 text-red-300 border-red-500/20" },
};

interface RecurringTransactionCardProps {
  item: RecurringTransaction;
  onTogglePause: (id: number, currentStatus: string) => void;
  onDelete: (id: number) => void;
}

export default function RecurringTransactionCard({
  item,
  onTogglePause,
  onDelete,
}: RecurringTransactionCardProps): React.JSX.Element {
  const freqLabel = FREQUENCY_LABELS[item.frequency] ?? item.frequency;
  const freqColor = FREQUENCY_COLORS[item.frequency] ?? "bg-white/10 text-white/60 border-white/10";
  const statusInfo = STATUS_BADGE[item.status] ?? STATUS_BADGE.active;
  const confidencePct = Math.round(Number(item.confidence_score) * 100);

  return (
    <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-6 flex flex-col gap-4 transition-all duration-200 hover:border-white/10 hover:bg-black/50">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate text-base leading-snug">{item.name}</div>
          {item.category_name && (
            <div className="text-xs text-white/40 mt-0.5 truncate">{item.category_name}</div>
          )}
        </div>
        <div className="text-xl font-bold text-white tabular-nums shrink-0">{money(item.amount)}</div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${freqColor}`}>
          {freqLabel}
        </span>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusInfo.className}`}>
          {statusInfo.icon} {statusInfo.label}
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-white/40 uppercase tracking-wider text-[10px]">Prochaine fois</span>
          <span className="text-white/80 font-medium">{item.next_occurrence ?? "—"}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-white/40 uppercase tracking-wider text-[10px]">Dernière fois</span>
          <span className="text-white/80 font-medium">{item.last_occurrence ?? "—"}</span>
        </div>
      </div>

      {/* Confidence bar */}
      {item.confidence_score > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40 uppercase tracking-wider">Confiance</span>
            <span className="text-white/60 font-medium">{confidencePct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onTogglePause(item.id, item.status)}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-medium border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all"
        >
          {item.status === "paused" ? "▶ Reprendre" : "⏸ Pause"}
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="py-2 px-3 rounded-xl text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
          aria-label="Supprimer"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
