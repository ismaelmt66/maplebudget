"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAssets, Asset, ApiError } from "@/lib/api";
import { money } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  stock: "Bourse / Placements",
  crypto: "Crypto-monnaies",
  real_estate: "Immobilier",
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  stock: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", bar: "bg-indigo-500" },
  crypto: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", bar: "bg-amber-500" },
  real_estate: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", bar: "bg-emerald-500" },
};

const EXPECTED_RETURNS: Record<string, number> = {
  stock: 6,
  crypto: 7,
  real_estate: 3,
};

function Sparkline({ history, positive }: { history: { date: string; balance: number }[]; positive: boolean }) {
  if (history.length < 2) return <div className="h-8 opacity-30 text-xs flex items-center">--</div>;
  const vals = history.map(h => h.balance);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 120, H = 32;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  const color = positive ? "#34d399" : "#f87171";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-8" preserveAspectRatio="none">
      <path d={`M ${pts.join(" L ")}`} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function InvestmentsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const data = await getAssets();
      setAssets(data);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/login");
      } else {
        setErr((e as Error)?.message ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const investments = useMemo(
    () => assets.filter(a => ["stock", "crypto", "real_estate"].includes(a.type)),
    [assets]
  );

  const totalInvested = useMemo(
    () => investments.reduce((s, a) => s + a.balance, 0),
    [investments]
  );

  const byType = useMemo(() => {
    const map: Record<string, { total: number; count: number; assets: Asset[] }> = {};
    for (const a of investments) {
      if (!map[a.type]) map[a.type] = { total: 0, count: 0, assets: [] };
      map[a.type].total += a.balance;
      map[a.type].count++;
      map[a.type].assets.push(a);
    }
    return map;
  }, [investments]);

  const projections = useMemo(() => {
    const years = [5, 10, 20];
    return years.map(y => {
      let projected = 0;
      for (const [type, data] of Object.entries(byType)) {
        const rate = (EXPECTED_RETURNS[type] ?? 3) / 100;
        projected += data.total * Math.pow(1 + rate, y);
      }
      return { years: y, value: projected };
    });
  }, [byType]);

  if (loading) {
    return (
      <main className="mb-container py-10">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="mb-container py-10 space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Investissements</span>
        </h1>
        <p className="text-white/50 mt-1">Suivi de votre portefeuille d&apos;investissement</p>
      </div>

      {err && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{err}</div>
      )}

      {investments.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-white/5 border border-dashed border-white/20">
          <div className="text-5xl mb-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-white/30"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </div>
          <p className="text-white/50 text-lg font-medium">Aucun investissement</p>
          <p className="text-white/30 text-sm mt-2">Ajoutez des actifs de type Bourse, Crypto ou Immobilier depuis la page Patrimoine.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider">Total Investi</div>
              <div className="text-2xl font-bold mt-2 text-white">{money(totalInvested)}</div>
            </div>
            <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider">Nombre d&apos;Actifs</div>
              <div className="text-2xl font-bold mt-2 text-white">{investments.length}</div>
            </div>
            <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider">Types</div>
              <div className="text-2xl font-bold mt-2 text-white">{Object.keys(byType).length}</div>
            </div>
          </div>

          {/* Allocation Breakdown */}
          <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
            <h2 className="text-lg font-bold mb-4">Allocation du Portefeuille</h2>
            <div className="space-y-3">
              {Object.entries(byType).map(([type, data]) => {
                const pct = totalInvested > 0 ? (data.total / totalInvested) * 100 : 0;
                const colors = TYPE_COLORS[type] ?? TYPE_COLORS.stock;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${colors.text}`}>
                        {TYPE_LABELS[type] ?? type}
                      </span>
                      <span className="text-sm text-white/60">
                        {money(data.total)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual Investments */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Vos Investissements</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {investments.map(asset => {
                const colors = TYPE_COLORS[asset.type] ?? TYPE_COLORS.stock;
                const history = asset.history || [];
                const firstVal = history.length >= 2 ? history[0].balance : asset.balance;
                const change = asset.balance - firstVal;
                const changePct = firstVal > 0 ? (change / firstVal) * 100 : 0;

                return (
                  <div key={asset.id} className={`rounded-2xl ${colors.bg} border ${colors.border} p-5 transition-all hover:-translate-y-0.5`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-white/50">{TYPE_LABELS[asset.type]}</div>
                        <div className="text-lg font-bold text-white mt-0.5">{asset.name}</div>
                      </div>
                      <Sparkline history={history} positive={change >= 0} />
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <div className="text-2xl font-black text-white">{money(asset.balance)}</div>
                      {history.length >= 2 && (
                        <div className={`text-sm font-semibold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {change >= 0 ? "+" : ""}{changePct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Projections */}
          <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
            <h2 className="text-lg font-bold mb-4">Projections</h2>
            <p className="text-sm text-white/40 mb-4">
              Estimation de la croissance de votre portefeuille selon les rendements historiques moyens par type d&apos;actif.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {projections.map(p => (
                <div key={p.years} className="rounded-2xl bg-white/5 border border-white/8 p-5 text-center">
                  <div className="text-xs text-white/40 uppercase tracking-wider">{p.years} ans</div>
                  <div className="text-xl font-bold text-emerald-400 mt-2">{money(p.value)}</div>
                  <div className="text-xs text-white/30 mt-1">
                    +{money(p.value - totalInvested)} ({((p.value / totalInvested - 1) * 100).toFixed(0)}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
