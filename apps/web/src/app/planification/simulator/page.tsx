"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { simulateProjection, type SimulatorResult, type SimulatorProjection } from "@/lib/api";
import { money } from "@/lib/format";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ExpenseCut = { label: string; monthly_amount: number };

type ScenarioParams = {
  name: string;
  monthlySavingsExtra: number;
  years: number;
  expectedReturn: number;
  cuts: ExpenseCut[];
};

type SavedScenario = {
  params: ScenarioParams;
  result: SimulatorResult;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SCENARIO_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#d946ef"];
const MAX_SCENARIOS = 3;

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; stroke: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const baseline = payload.find(p => p.dataKey === "Patrimoine de base");
  const scenarios = payload.filter(p => p.dataKey !== "Patrimoine de base");

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl min-w-[240px]">
      <p className="text-white/70 text-xs font-medium mb-2">{label}</p>
      <div className="space-y-2 text-xs">
        {baseline && (
            <div className="flex justify-between gap-4">
                <span className="text-white/50">Patrimoine de base</span>
                <span className="text-white/80 font-mono">{money(baseline.value)}</span>
            </div>
        )}
        {scenarios.map(s => (
            <div key={s.dataKey} className="flex justify-between gap-4">
                <span style={{ color: s.stroke }}>{s.dataKey}</span>
                <span className="font-mono font-semibold" style={{ color: s.stroke }}>{money(s.value)}</span>
            </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SimulatorPage() {
  // Scenario editing state
  const [currentParams, setCurrentParams] = useState<ScenarioParams>({
    name: "Scénario Actuel",
    monthlySavingsExtra: 250,
    years: 20,
    expectedReturn: 6,
    cuts: [],
  });
  const [newCutLabel, setNewCutLabel] = useState("");
  const [newCutAmount, setNewCutAmount] = useState(0);

  // Simulation results
  const [baselineResult, setBaselineResult] = useState<SimulatorResult | null>(null);
  const [currentResult, setCurrentResult] = useState<SimulatorResult | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [loading, setLoading] = useState(true);
  
  /* ---- Simulation Runner ---- */
  const runSimulation = useCallback(async (params: ScenarioParams) => {
    try {
      return await simulateProjection({
        monthly_savings_extra: params.monthlySavingsExtra,
        expense_cuts: params.cuts,
        years: params.years,
        expected_return: params.expectedReturn,
      });
    } catch {
      return null;
    }
  }, []);
  
  // Effect to run all simulations when params change
  useEffect(() => {
    const handler = setTimeout(async () => {
      setLoading(true);
      const baselinePromise = runSimulation({ ...currentParams, monthlySavingsExtra: 0, cuts: [] });
      const currentPromise = runSimulation(currentParams);
      const [baseRes, currentRes] = await Promise.all([baselinePromise, currentPromise]);
      setBaselineResult(baseRes);
      setCurrentResult(currentRes);
      setLoading(false);
    }, 600);
    return () => clearTimeout(handler);
  }, [currentParams, runSimulation]);


  /* ---- Cut management ---- */
  const addCut = () => {
    if (!newCutLabel.trim() || newCutAmount <= 0) return;
    setCurrentParams(p => ({ ...p, cuts: [...p.cuts, { label: newCutLabel.trim(), monthly_amount: newCutAmount }]}));
    setNewCutLabel("");
    setNewCutAmount(0);
  }
  const removeCut = (i: number) => {
    setCurrentParams(p => ({ ...p, cuts: p.cuts.filter((_, idx) => idx !== i)}));
  }

  /* ---- Save / load scenario ---- */
  const saveCurrentScenario = () => {
    if (!currentResult || savedScenarios.length >= MAX_SCENARIOS) return;
    const name = currentParams.name.trim();
    const finalName = name === "Scénario Actuel" ? `Scénario ${savedScenarios.length + 1}` : name;
    setSavedScenarios(prev => [...prev, { params: { ...currentParams, name: finalName }, result: currentResult }]);
    setCurrentParams(p => ({ ...p, name: `Scénario ${savedScenarios.length + 2}`}));
  };
  const removeScenario = (i: number) => {
    setSavedScenarios(prev => prev.filter((_, idx) => idx !== i));
  }

  /* ---- Chart data merging ---- */
  const { chartData, maxYear } = useMemo(() => {
    const allProjections = [baselineResult, currentResult, ...savedScenarios.map(s => s.result)];
    const maxYear = allProjections.reduce((max, r) => Math.max(max, r?.projections.length ?? 0), 0);
    if (maxYear === 0) return { chartData: [], maxYear: 0 };
    
    const data = Array.from({ length: maxYear }, (_, i) => {
        const year = i + 1;
        const row: Record<string, any> = { name: `An ${year}` };
        
        if (baselineResult && i < baselineResult.projections.length) {
            row["Patrimoine de base"] = baselineResult.projections[i].optimized;
        }
        if (currentResult && i < currentResult.projections.length) {
            row[currentParams.name] = currentResult.projections[i].optimized;
        }
        savedScenarios.forEach((s, idx) => {
            if (s.result && i < s.result.projections.length) {
                row[s.params.name] = s.result.projections[i].optimized;
            }
        });
        return row;
    });

    return { chartData: data, maxYear };
  }, [baselineResult, currentResult, savedScenarios, currentParams.name]);


  return (
    <main className="animate-fade-in-up max-w-7xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Simulateur{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            &laquo; Et si... &raquo;
          </span>
        </h1>
        <p className="text-white/50 mt-2 max-w-2xl">
          Visualisez l'évolution de votre patrimoine. Ajustez votre épargne, vos dépenses et vos placements pour comparer jusqu'à {MAX_SCENARIOS+1} scénarios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ============ Left column: Chart ============ */}
        <div className="lg:col-span-8 bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-white/80">
              Projection du Patrimoine Net
              {loading && <span className="ml-2 text-white/30 text-xs animate-pulse">Calcul...</span>}
            </h2>
          </div>

          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="grad_base" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#888" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#888" stopOpacity={0} />
                  </linearGradient>
                  {([currentParams, ...savedScenarios.map(s => s.params)]).map((s, i) => (
                    <linearGradient key={s.name} id={`grad_${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SCENARIO_COLORS[i]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={SCENARIO_COLORS[i]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k$`} />
                <Tooltip content={<CustomTooltip />} />

                <Area type="monotone" dataKey="Patrimoine de base" stroke="#888" strokeWidth={2} strokeDasharray="5 5" fill="url(#grad_base)" />
                <Area type="monotone" dataKey={currentParams.name} stroke={SCENARIO_COLORS[0]} strokeWidth={2.5} fill="url(#grad_0)" />
                {savedScenarios.map((s, i) => (
                  <Area key={s.params.name} type="monotone" dataKey={s.params.name} stroke={SCENARIO_COLORS[i + 1]} strokeWidth={2.5} fill={`url(#grad_${i+1})`} />
                ))}

              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ============ Right column: Controls ============ */}
        <div className="lg:col-span-4 space-y-4">
            <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-4">
                <input
                    type="text"
                    placeholder='Nom du scénario (ex: "Agressif")'
                    value={currentParams.name}
                    onChange={(e) => setCurrentParams(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-transparent text-white font-semibold text-lg focus:outline-none placeholder-white/30 mb-3"
                />
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-white/50 mb-1 flex justify-between"><span>Épargne / mois</span> <span className="font-bold text-violet-400">{money(currentParams.monthlySavingsExtra)}</span></label>
                        <input type="range" min={0} max={2000} step={25} value={currentParams.monthlySavingsExtra} onChange={(e) => setCurrentParams(p => ({ ...p, monthlySavingsExtra: Number(e.target.value)}))} className="w-full accent-violet-500" />
                    </div>
                    <div>
                        <label className="text-xs text-white/50 mb-1 flex justify-between"><span>Horizon</span> <span className="font-bold text-violet-400">{currentParams.years} ans</span></label>
                        <input type="range" min={1} max={40} step={1} value={currentParams.years} onChange={(e) => setCurrentParams(p => ({ ...p, years: Number(e.target.value)}))} className="w-full accent-violet-500" />
                    </div>
                    <div>
                        <label className="text-xs text-white/50 mb-1 flex justify-between"><span>Rendement / an</span> <span className="font-bold text-violet-400">{currentParams.expectedReturn}%</span></label>
                        <input type="range" min={0} max={12} step={0.5} value={currentParams.expectedReturn} onChange={(e) => setCurrentParams(p => ({ ...p, expectedReturn: Number(e.target.value)}))} className="w-full accent-violet-500" />
                    </div>
                </div>
            </div>

            <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white/80">Dépenses à éliminer</p>
                {currentParams.cuts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
                        <span className="text-white/80">{c.label}</span>
                        <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold text-xs">-{money(c.monthly_amount)}</span>
                        <button onClick={() => removeCut(i)} className="text-white/30 hover:text-red-400 transition-colors text-xs">✕</button>
                        </div>
                    </div>
                ))}
                <div className="flex gap-2">
                    <input type="text" placeholder="Ex: Restos" value={newCutLabel} onChange={(e) => setNewCutLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCut()} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50" />
                    <input type="number" placeholder="$/mois" min={0} value={newCutAmount || ""} onChange={(e) => setNewCutAmount(Number(e.target.value))} onKeyDown={(e) => e.key === "Enter" && addCut()} className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50" />
                    <button onClick={addCut} className="px-2.5 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition-colors text-xs font-semibold">+</button>
                </div>
            </div>

            <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-4 space-y-2">
                <button onClick={saveCurrentScenario} disabled={!currentResult || savedScenarios.length >= MAX_SCENARIOS} className="w-full px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed">
                    Comparer ce scénario
                </button>
                {savedScenarios.length > 0 && (
                    <div className="space-y-2 pt-1">
                        {savedScenarios.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white/5 rounded-xl pl-3 pr-2 py-1.5 text-sm group">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[idx+1] }} />
                                    <span className="text-white/80 font-medium">{s.params.name}</span>
                                </div>
                                <button onClick={() => removeScenario(idx)} className="text-white/30 hover:text-red-400 transition-colors text-xs px-1.5 py-1 rounded-md">✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
      </div>
    </main>
  );
}
