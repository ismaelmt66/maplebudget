"use client";

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
  daily: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  weekly: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  biweekly: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  monthly: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  quarterly: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  yearly: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  active: {
    label: "Actif",
    dot: "bg-emerald-400",
    badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  },
  paused: {
    label: "Pausé",
    dot: "bg-yellow-400",
    badge: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
  },
  ended: {
    label: "Terminé",
    dot: "bg-red-400",
    badge: "text-red-300 bg-red-500/10 border-red-500/20",
  },
};

interface Props {
  recurring: RecurringTransaction;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function RecurringTransactionCard({ recurring, onPause, onResume, onDelete }: Props) {
  const statusCfg = STATUS_CONFIG[recurring.status ?? "active"] ?? STATUS_CONFIG["active"];
  const freqLabel = FREQUENCY_LABELS[recurring.frequency] ?? recurring.frequency;
  const freqColor = FREQUENCY_COLORS[recurring.frequency] ?? "bg-white/10 text-white/60 border-white/10";
  const confidencePct = Math.round((recurring.confidence_score ?? 1) * 100);

  function formatDate(d: string | null) {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  return (
    <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-6 flex flex-col gap-4 hover:border-white/10 transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-lg leading-tight truncate">{recurring.name}</h3>
          {recurring.category_name && (
            <span className="text-xs text-white/40 mt-0.5 block">{recurring.category_name}</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-white">{money(recurring.amount)}</div>
          <div className="text-xs text-white/40 mt-0.5">{freqLabel}</div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Frequency badge */}
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${freqColor}`}>
          🔄 {freqLabel}
        </span>

        {/* Status badge */}
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white/5 border border-white/5 p-3">
          <div className="text-white/40 text-xs mb-1">Dernière occurrence</div>
          <div className="text-white font-medium">{formatDate(recurring.last_occurrence ?? null)}</div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/5 p-3">
          <div className="text-white/40 text-xs mb-1">Prochaine occurrence</div>
          <div className="text-white font-medium">{formatDate(recurring.next_occurrence ?? null)}</div>
        </div>
      </div>

      {/* Confidence score */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/40">Confiance de détection</span>
          <span className="text-xs font-medium text-white/60">{confidencePct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        {recurring.status === "active" ? (
          <button
            onClick={() => onPause(recurring.id)}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all"
          >
            ⏸ Pauser
          </button>
        ) : recurring.status === "paused" ? (
          <button
            onClick={() => onResume(recurring.id)}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
          >
            ▶ Reprendre
          </button>
        ) : null}

        <button
          onClick={() => onDelete(recurring.id)}
          className="py-2 px-4 rounded-xl text-xs font-medium text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
          aria-label="Supprimer"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
