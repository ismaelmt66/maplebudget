"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { money } from "@/lib/format";

type Scenario = {
  name: string;
  rrsp_contribution: number;
  tfsa_contribution: number;
  tax_refund: number;
  net_cost: number;
  projected_10y: number;
  projected_20y: number;
  projected_30y: number;
};

type Result = {
  marginal_rate: number;
  rrsp_room: number;
  tfsa_room: number;
  recommended_rrsp: number;
  recommended_tfsa: number;
  tax_refund: number;
  scenarios: Scenario[];
  tips: string[];
};

const PROVINCES = [
  { value: "QC", label: "Québec" },
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "AB", label: "Alberta" },
  { value: "other", label: "Autre province" },
];

export default function CanadaPage() {
  const [income, setIncome] = useState(75000);
  const [province, setProvince] = useState("QC");
  const [savings, setSavings] = useState(10000);
  const [age, setAge] = useState(30);
  const [existingRrsp, setExistingRrsp] = useState(0);
  const [existingTfsa, setExistingTfsa] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(0);

  async function calculate() {
    setLoading(true);
    try {
      const data = await apiFetch("/canada/rrsp-tfsa", {
        method: "POST",
        body: JSON.stringify({
          annual_income: income,
          province,
          available_savings: savings,
          age,
          existing_rrsp: existingRrsp,
          existing_tfsa: existingTfsa,
        }),
      });
      setResult(data as Result);
      setSelectedScenario(0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const scenario = result?.scenarios[selectedScenario];

  return (
    <main className="animate-fade-in-up max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Optimiseur{" "}
          <span className="bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">
            REER / CELI
          </span>
        </h1>
        <p className="text-white/50 mt-2 text-sm">
          Calculez votre stratégie d&apos;épargne fiscalement optimale selon votre profil canadien.
        </p>
      </div>

      {/* Form */}
      <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="text-base font-bold text-white">🍁 Votre profil fiscal</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Revenu annuel brut ($)</label>
            <input
              type="number"
              value={income}
              onChange={e => setIncome(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Province</label>
            <select
              value={province}
              onChange={e => setProvince(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            >
              {PROVINCES.map(p => (
                <option key={p.value} value={p.value} className="bg-zinc-900">{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Épargne disponible cette année ($)</label>
            <input
              type="number"
              value={savings}
              onChange={e => setSavings(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Âge</label>
            <input
              type="number"
              value={age}
              onChange={e => setAge(Number(e.target.value))}
              min={18}
              max={71}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">REER existant ($)</label>
            <input
              type="number"
              value={existingRrsp}
              onChange={e => setExistingRrsp(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">CELI existant ($)</label>
            <input
              type="number"
              value={existingTfsa}
              onChange={e => setExistingTfsa(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:brightness-110 text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50"
        >
          {loading ? "Calcul en cours..." : "🍁 Calculer mon optimisation"}
        </button>
      </div>

      {result && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-xs text-white/50 mb-1">Taux marginal</div>
              <div className="text-2xl font-bold text-rose-400">{result.marginal_rate}%</div>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-xs text-white/50 mb-1">Droits REER</div>
              <div className="text-xl font-bold text-violet-400">{money(result.rrsp_room)}</div>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-xs text-white/50 mb-1">Droits CELI</div>
              <div className="text-xl font-bold text-fuchsia-400">{money(result.tfsa_room)}</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
              <div className="text-xs text-white/50 mb-1">Remboursement REER</div>
              <div className="text-xl font-bold text-emerald-400">{money(result.tax_refund)}</div>
            </div>
          </div>

          {/* Recommended allocation */}
          <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-violet-400 text-xl">⭐</span>
              <h2 className="text-base font-bold text-white">Stratégie recommandée</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-xs text-white/50 mb-1">Contribution REER</div>
                <div className="text-2xl font-bold text-violet-400">{money(result.recommended_rrsp)}</div>
                <div className="text-xs text-white/40 mt-1">Déduction fiscale immédiate</div>
              </div>
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-xs text-white/50 mb-1">Contribution CELI</div>
                <div className="text-2xl font-bold text-fuchsia-400">{money(result.recommended_tfsa)}</div>
                <div className="text-xs text-white/40 mt-1">Croissance 100% non imposable</div>
              </div>
            </div>
          </div>

          {/* Scenario comparison */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4">📊 Comparaison des scénarios</h2>

            {/* Scenario tabs */}
            <div className="flex flex-wrap gap-2 mb-5">
              {result.scenarios.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedScenario(i)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    selectedScenario === i
                      ? "bg-violet-500 text-white"
                      : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {i === 0 && "⭐ "}{s.name}
                </button>
              ))}
            </div>

            {scenario && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-xs text-white/40 mb-1">REER</div>
                    <div className="text-lg font-bold text-violet-400">{money(scenario.rrsp_contribution)}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-xs text-white/40 mb-1">CELI</div>
                    <div className="text-lg font-bold text-fuchsia-400">{money(scenario.tfsa_contribution)}</div>
                  </div>
                  <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                    <div className="text-xs text-white/40 mb-1">Remboursement</div>
                    <div className="text-lg font-bold text-emerald-400">{money(scenario.tax_refund)}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-xs text-white/40 mb-1">Coût net</div>
                    <div className="text-lg font-bold text-white">{money(scenario.net_cost)}</div>
                  </div>
                </div>

                {/* Projections */}
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Projections de croissance</div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Dans 10 ans", value: scenario.projected_10y, color: "text-indigo-400" },
                      { label: "Dans 20 ans", value: scenario.projected_20y, color: "text-violet-400" },
                      { label: "Dans 30 ans", value: scenario.projected_30y, color: "text-fuchsia-400" },
                    ].map(p => (
                      <div key={p.label} className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-xs text-white/40 mb-2">{p.label}</div>
                        <div className={`text-xl font-bold ${p.color}`}>{money(p.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tips */}
          {result.tips.length > 0 && (
            <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
              <h2 className="text-base font-bold text-white mb-4">💡 Conseils personnalisés</h2>
              <div className="space-y-3">
                {result.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="text-violet-400 text-base mt-0.5">→</span>
                    <p className="text-sm text-white/70 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-white/20 text-center">
            Ces projections sont à titre indicatif uniquement. Consultez un conseiller financier agréé pour des conseils personnalisés.
          </p>
        </>
      )}
    </main>
  );
}
