"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Benchmark = {
  your_savings_rate: number;
  avg_savings_rate: number;
  your_expense_ratio: number;
  avg_expense_ratio: number;
  your_score: number;
  percentile: number;
  badge: string;
  tips: string[];
};

function RadialScore({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 60 ? "#34d399" : score >= 40 ? "#a78bfa" : "#f87171";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold text-white">{score}</div>
        <div className="text-xs text-white/40">/ 100</div>
      </div>
    </div>
  );
}

function CompareBar({ label, yours, avg, unit = "%" }: { label: string; yours: number; avg: number; unit?: string }) {
  const max = Math.max(yours, avg, 1);
  const betterIsHigher = label.includes("Épargne");
  const yoursWin = betterIsHigher ? yours >= avg : yours <= avg;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className={yoursWin ? "text-emerald-400" : "text-red-400"}>{yours.toFixed(1)}{unit} vs moy. {avg.toFixed(1)}{unit}</span>
      </div>
      <div className="flex gap-1 items-center">
        <div className="flex-1 space-y-1">
          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`absolute h-full rounded-full transition-all duration-700 ${yoursWin ? "bg-emerald-400" : "bg-red-400"}`}
              style={{ width: `${(yours / max) * 100}%` }}
            />
          </div>
          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="absolute h-full rounded-full bg-white/20 transition-all duration-700"
              style={{ width: `${(avg / max) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className="flex gap-3 text-[10px] text-white/30">
        <span>▬ Vous</span>
        <span className="opacity-60">▬ Moyenne</span>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const [data, setData] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/community/benchmark")
      .then(d => setData(d as Benchmark))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="animate-fade-in-up max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Score{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Communautaire
          </span>
        </h1>
        <p className="text-white/50 mt-2 text-sm">
          Comparez vos habitudes financières à la communauté NexLedger — 100% anonyme.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-white/30 animate-pulse">Analyse communautaire en cours...</div>
      ) : !data ? (
        <div className="text-center py-16 text-white/40">
          Ajoutez des transactions pour obtenir votre score.
        </div>
      ) : (
        <>
          {/* Score card */}
          <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <RadialScore score={data.your_score} />
              <div className="flex-1 space-y-3 text-center md:text-left">
                <div className="text-2xl font-bold text-white">{data.badge}</div>
                <div className="text-sm text-white/60">
                  Vous faites mieux que{" "}
                  <span className="text-violet-400 font-bold text-base">{data.percentile}%</span>{" "}
                  de la communauté ce mois-ci.
                </div>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60">
                    Épargne : <span className="text-emerald-400 font-bold">{data.your_savings_rate}%</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60">
                    Dépenses : <span className="text-red-400 font-bold">{data.your_expense_ratio}%</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60">
                    Top <span className="text-violet-400 font-bold">{100 - data.percentile}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparaison */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-bold text-white">📊 Vous vs la Communauté</h2>
            <CompareBar
              label="Taux d'Épargne"
              yours={data.your_savings_rate}
              avg={data.avg_savings_rate}
            />
            <CompareBar
              label="Ratio Dépenses/Revenus"
              yours={data.your_expense_ratio}
              avg={data.avg_expense_ratio}
            />
          </div>

          {/* Levels */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4">🎖️ Niveaux</h2>
            <div className="space-y-2">
              {[
                { min: 80, badge: "🏆 Expert Épargne", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
                { min: 60, badge: "🥈 Épargnant Solide", color: "text-slate-300", bg: "bg-slate-500/10 border-slate-500/20" },
                { min: 40, badge: "🥉 En Progression", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20" },
                { min: 20, badge: "📈 Débutant", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
                { min: 0, badge: "💡 À Améliorer", color: "text-white/50", bg: "bg-white/5 border-white/10" },
              ].map(level => (
                <div
                  key={level.badge}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${level.bg} ${data.badge === level.badge ? "ring-1 ring-violet-500/50" : ""}`}
                >
                  <span className={`text-sm font-medium ${level.color}`}>{level.badge}</span>
                  <span className="text-xs text-white/30">Score ≥ {level.min}</span>
                  {data.badge === level.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/20 ml-2">Votre niveau</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4">💡 Recommandations</h2>
            <div className="space-y-3">
              {data.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className="text-violet-400 mt-0.5">→</span>
                  <p className="text-sm text-white/70 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/20 text-center">
            Les comparaisons sont entièrement anonymes — aucune donnée personnelle n&apos;est partagée.
          </p>
        </>
      )}
    </main>
  );
}
