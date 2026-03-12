"use client";

import { useEffect, useState } from "react";
import { simulateProjection, type SimulatorResult, type SimulatorProjection } from "@/lib/api";
import { money } from "@/lib/format";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type ExpenseCut = { label: string; monthly_amount: number };

export default function SimulatorPage() {
  const [monthlySavingsExtra, setMonthlySavingsExtra] = useState(0);
  const [years, setYears] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState(5);
  const [cuts, setCuts] = useState<ExpenseCut[]>([]);
  const [newCutLabel, setNewCutLabel] = useState("");
  const [newCutAmount, setNewCutAmount] = useState(0);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [loading, setLoading] = useState(false);

  const totalMonthlyGain = monthlySavingsExtra + cuts.reduce((s, c) => s + c.monthly_amount, 0);

  async function runSimulation() {
    setLoading(true);
    try {
      const res = await simulateProjection({
        monthly_savings_extra: monthlySavingsExtra,
        expense_cuts: cuts,
        years,
        expected_return: expectedReturn,
      });
      setResult(res);
    } catch {
      // silence
    } finally {
      setLoading(false);
    }
  }

  // Auto-run on param change
  useEffect(() => {
    const t = setTimeout(runSimulation, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlySavingsExtra, years, expectedReturn, cuts]);

  function addCut() {
    if (!newCutLabel.trim() || newCutAmount <= 0) return;
    setCuts((prev) => [...prev, { label: newCutLabel.trim(), monthly_amount: newCutAmount }]);
    setNewCutLabel("");
    setNewCutAmount(0);
  }

  function removeCut(i: number) {
    setCuts((prev) => prev.filter((_, idx) => idx !== i));
  }

  const chartData = result?.projections.map((p: SimulatorProjection) => ({
    name: `An ${p.year}`,
    "Sans changement": Math.round(p.baseline),
    "Avec optimisation": Math.round(p.optimized),
  })) ?? [];

  return (
    <main className="animate-fade-in-up max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Simulateur <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">« Et si... »</span>
        </h1>
        <p className="text-white/50 mt-2">Visualise l'impact de tes décisions financières sur le long terme.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panneaux de contrôle */}
        <div className="space-y-4">

          {/* Épargne supplémentaire */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5">
            <label className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              💰 Épargne supplémentaire par mois
              <span className="ml-auto text-violet-400 font-bold">{money(monthlySavingsExtra)}</span>
            </label>
            <input
              type="range" min={0} max={2000} step={25}
              value={monthlySavingsExtra}
              onChange={(e) => setMonthlySavingsExtra(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-white/30 mt-1">
              <span>0$</span><span>2 000$/mois</span>
            </div>
          </div>

          {/* Couper des abonnements */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 space-y-3">
            <p className="text-sm font-semibold text-white/80">✂️ Dépenses à éliminer</p>
            {cuts.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 text-sm">
                <span className="text-white/80">{c.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-semibold">-{money(c.monthly_amount)}/mois</span>
                  <button onClick={() => removeCut(i)} className="text-white/30 hover:text-red-400 transition-colors text-xs">✕</button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text" placeholder="Nom (ex: Netflix)"
                value={newCutLabel}
                onChange={(e) => setNewCutLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCut()}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
              />
              <input
                type="number" placeholder="$/mois" min={0}
                value={newCutAmount || ""}
                onChange={(e) => setNewCutAmount(Number(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && addCut()}
                className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={addCut}
                className="px-3 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-semibold"
              >
                +
              </button>
            </div>
          </div>

          {/* Horizon & Rendement */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
                📅 Horizon
                <span className="ml-auto text-violet-400 font-bold">{years} ans</span>
              </label>
              <input
                type="range" min={1} max={40} step={1}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>1 an</span><span>40 ans</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
                📈 Rendement annuel estimé
                <span className="ml-auto text-violet-400 font-bold">{expectedReturn}%</span>
              </label>
              <input
                type="range" min={0} max={12} step={0.5}
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>0% (épargne)</span><span>12% (actions)</span>
              </div>
            </div>
          </div>

          {/* Résumé */}
          {result && (
            <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 rounded-2xl p-5 space-y-2">
              <p className="text-sm text-white/60">{result.summary}</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-black/30 rounded-xl p-3 text-center">
                  <div className="text-xs text-white/40 mb-1">Gain mensuel</div>
                  <div className="text-lg font-bold text-emerald-400">+{money(result.monthly_gain)}</div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 text-center">
                  <div className="text-xs text-white/40 mb-1">Gain total en {years} ans</div>
                  <div className="text-lg font-bold text-fuchsia-400">+{money(result.total_saved_extra)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Graphique */}
        <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-white/80 mb-4">
            Projection sur {years} ans
            {loading && <span className="ml-2 text-white/30 text-xs animate-pulse">Calcul...</span>}
          </h2>
          {result ? (
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOpt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k$`} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    formatter={(v: number | undefined) => [money(v ?? 0), ""]}
                  />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="Sans changement" stroke="#6366f1" strokeWidth={2} fill="url(#colorBase)" />
                  <Area type="monotone" dataKey="Avec optimisation" stroke="#a855f7" strokeWidth={2} fill="url(#colorOpt)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
              Ajuste les paramètres pour voir la projection
            </div>
          )}
        </div>
      </div>

      {/* Table détaillée */}
      {result && result.projections.length > 0 && (
        <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-white/80 mb-4">Détail année par année</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-left py-2 font-medium">Année</th>
                <th className="text-right py-2 font-medium">Sans changement</th>
                <th className="text-right py-2 font-medium">Avec optimisation</th>
                <th className="text-right py-2 font-medium">Différence</th>
              </tr>
            </thead>
            <tbody>
              {result.projections.filter((_, i) => i % Math.max(1, Math.floor(result.projections.length / 10)) === 0 || i === result.projections.length - 1).map((p) => (
                <tr key={p.year} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="py-2 text-white/70">An {p.year}</td>
                  <td className="py-2 text-right text-indigo-300">{money(p.baseline)}</td>
                  <td className="py-2 text-right text-violet-300">{money(p.optimized)}</td>
                  <td className="py-2 text-right text-emerald-400 font-semibold">+{money(p.difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
