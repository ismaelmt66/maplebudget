"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getCategories, getTransactions, Category, Transaction, apiFetch } from "@/lib/api";
import BankConnectButton from "@/components/BankConnectButton";

// type d’aide utilisé uniquement dans ce fichier pour traiter les données de
// transaction ; nous enrichissons le `Transaction` renvoyé par l’API avec des
// champs dérivés qui simplifient la logique d’affichage.
type Tx = Transaction & {
  amountNum: number;
  catName: string;
  catType: "income" | "expense";
};

// point unique affiché dans le graphique d’évolution. `key` contient la date
// ISO, tandis que `label` est une version lisible pour les graduations.
type SeriesPoint = {
  key: string;     // YYYY-MM-DD
  label: string;   // display
  income: number;
  expense: number;
  net: number;
};

// les utilitaires de formatage sont dans un module partagé ; on importe ici
// ceux dont on a besoin afin que la même logique reste cohérente partout.
import { money, ymd, addDays, parseYMD } from "@/lib/format";
import { DonutChart } from "@/components/DashboardDonut";
const LOCALE = "fr-CA";

// formate les nombres simples selon la locale (sans symbole monétaire)
function num(n: number) {
  return new Intl.NumberFormat(LOCALE).format(n);
}

/**
 * Simple boundary clamp.
 */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Convert a Date to a short month/day label for chart axes.
 */
function dayLabel(d: Date) {
  return d.toLocaleDateString(LOCALE, { month: "short", day: "2-digit" });
}

/**
 * Renders a single Key Performance Indicator card on the dashboard.
 */
function KPI({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const toneStyle =
    tone === "good"
      ? { borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", boxShadow: "0 0 30px rgba(34,197,94,0.1)" }
      : tone === "bad"
        ? { borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", boxShadow: "0 0 30px rgba(239,68,68,0.1)" }
        : tone === "warn"
          ? { borderColor: "rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.1)", boxShadow: "0 0 30px rgba(234,179,8,0.1)" }
          : { borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", boxShadow: "0 0 30px rgba(255,255,255,0.02)" };

  return (
    <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:brightness-110" style={toneStyle as React.CSSProperties}>
      <div className="text-sm opacity-70 font-medium tracking-wide uppercase">{label}</div>
      <div className="text-3xl font-bold mt-2 tracking-tight">{value}</div>
      {hint && <div className="text-xs opacity-60 mt-3">{hint}</div>}
    </div>
  );
}

/**
 * Renders an interactive SVG chart demonstrating the trend over time
 * for the given metric (net, income, or expense).
 */
function TrendChart({
  series,
  mode,
}: {
  series: SeriesPoint[];
  mode: "net" | "income" | "expense";
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);
  const [wrapWidth, setWrapWidth] = useState(1000);
  const [wrapHeight, setWrapHeight] = useState(400);

  // Anti-flash: on met un petit délai avant de cacher
  const hideTimer = useRef<number | null>(null);

  const summary = useMemo(() => {
    const income = series.reduce((s, p) => s + p.income, 0);
    const expense = series.reduce((s, p) => s + p.expense, 0);
    const net = income - expense;

    const ratio = income > 0 ? expense / income : expense > 0 ? 999 : 0;

    let status: "healthy" | "watch" | "risk" | "none" = "none";
    if (income === 0 && expense === 0) status = "none";
    else if (income === 0 && expense > 0) status = "risk";
    else if (net >= 0 && ratio < 0.85) status = "healthy";
    else if (ratio < 0.97) status = "watch";
    else status = "risk";

    const savingsRate = income > 0 ? (net / income) * 100 : 0;

    return { income, expense, net, ratio, status, savingsRate };
  }, [series]);

  const data = useMemo(() => {
    if (series.length < 2) return null;

    const W = 1000;
    const H = 360;
    const PAD_L = 54;
    const PAD_R = 24;
    const PAD_T = 26;
    const PAD_B = 38;

    const values = series.map((p) =>
      mode === "income" ? p.income : mode === "expense" ? p.expense : p.net
    );

    let min = Math.min(...values);
    let max = Math.max(...values);

    // Si toutes les valeurs sont à 0 ou identiques
    if (min === max) {
      if (max === 0) {
        min = -100;
        max = 100;
      } else {
        // Ex: si tout est à 1500, on met un range de 0 à 2000
        const margin = Math.abs(max) * 0.2 || 10;
        min -= margin;
        max += margin;
      }
    }

    const span = max - min || 1;
    const pad = span * 0.12;
    min -= pad;
    max += pad;

    // Le nouveau span réel après padding
    const realSpan = max - min;
    const xStep = (W - PAD_L - PAD_R) / (values.length - 1);

    const pts = values.map((v, i) => {
      const x = PAD_L + i * xStep;
      const y = PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / realSpan);
      return { x, y, v, i };
    });

    // Courbe de Bézier douce
    const line = pts.reduce((acc, p, i, a) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = a[i - 1];
      const cp1x = prev.x + (p.x - prev.x) / 2;
      return `${acc} C ${cp1x},${prev.y} ${cp1x},${p.y} ${p.x},${p.y}`;
    }, "");

    const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;

    const y0 =
      mode === "net"
        ? Math.min(Math.max(PAD_T + (H - PAD_T - PAD_B) * (1 - (0 - min) / realSpan), PAD_T), H - PAD_B)
        : null;

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const t = i / 4;
      const v = max - t * (max - min);
      const y = PAD_T + (H - PAD_T - PAD_B) * t;
      return { v, y };
    });

    return { W, H, PAD_L, PAD_R, PAD_T, PAD_B, pts, min, max, line, area, ticks, y0 };
  }, [series, mode]);

  const theme = useMemo(() => {
    const GOOD = { s: "rgba(34,197,94,0.90)", a1: "rgba(34,197,94,0.22)", a2: "rgba(34,197,94,0.02)" };
    const WARN = { s: "rgba(234,179,8,0.90)", a1: "rgba(234,179,8,0.20)", a2: "rgba(234,179,8,0.02)" };
    const BAD = { s: "rgba(239,68,68,0.90)", a1: "rgba(239,68,68,0.18)", a2: "rgba(239,68,68,0.02)" };
    const PRI = { s: "rgba(96,165,250,0.90)", a1: "rgba(96,165,250,0.20)", a2: "rgba(96,165,250,0.02)" };

    if (mode === "income") return GOOD;
    if (mode === "expense") return WARN;

    if (summary.status === "healthy") return GOOD;
    if (summary.status === "watch") return WARN;
    if (summary.status === "risk") return BAD;
    return PRI;
  }, [mode, summary.status]);

  function clearHideTimer() {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setHoverIdx(null); // ✅ disparaît bien quand on retire le curseur
    }, 160);
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!data) return;
    clearHideTimer();

    const rect = e.currentTarget.getBoundingClientRect();
    if (wrapRef.current) {
      setWrapWidth(wrapRef.current.clientWidth);
      setWrapHeight(wrapRef.current.clientHeight);
    }

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const vx = (x / rect.width) * data.W;

    const left = data.PAD_L;
    const right = data.W - data.PAD_R;

    // si on sort de la zone utile, on cache vite
    if (vx < left - 6 || vx > right + 6) {
      scheduleHide();
      return;
    }

    // nearest point (plus fiable que l'arrondi)
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < data.pts.length; i++) {
      const dx = Math.abs(data.pts[i].x - vx);
      if (dx < bestDist) {
        bestDist = dx;
        best = i;
      }
    }

    setHoverIdx(best);
    setMx(x);
    setMy(y);
  }

  function onLeave() {
    scheduleHide();
  }

  // Summary stat helpers
  const stats = useMemo(() => {
    if (!data || data.pts.length === 0) return null;
    const vals = data.pts.map(p => p.v);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const avgVal = vals.reduce((a, b) => a + b, 0) / vals.length;

    // Find points
    const maxPt = data.pts.find(p => p.v === maxVal);
    const minPt = data.pts.find(p => p.v === minVal);

    return { minVal, maxVal, avgVal, maxPt, minPt };
  }, [data]);

  if (!data) {
    return <div className="text-sm opacity-70 p-6 flex justify-center">Pas assez de données pour afficher le graphique.</div>;
  }

  const hi = hoverIdx !== null ? data.pts[hoverIdx] : null;

  const statusLabel =
    summary.status === "healthy" ? "Sain" :
      summary.status === "watch" ? "Surveillance" :
        summary.status === "risk" ? "Risque" : "Aucune donnée";

  return (
    <div className="chart-shell p-4 md:p-6 relative rounded-3xl bg-black/40 border border-white/5 backdrop-blur-md shadow-2xl h-full flex flex-col" ref={wrapRef}>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              Évolution {mode === "net" ? "Nette" : mode === "income" ? "des Revenus" : "des Dépenses"}
            </h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/10" style={{ color: theme.s }}>
              {statusLabel}
            </span>
          </div>
          <div className="text-sm opacity-70 mt-2 flex gap-4">
            {stats && (
              <>
                <span title="Moyenne sur la période">Moy. <strong className="text-white">{money(stats.avgVal)}</strong></span>
                <span title="Pic maximum">Max. <strong className="text-white">{money(stats.maxVal)}</strong></span>
              </>
            )}
            {summary.income > 0 && (
              <span className="opacity-50">| Dépenses/Revenus: {Math.round(summary.ratio * 100)}%</span>
            )}
          </div>
        </div>
        <div className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 animate-pulse">
          Survolez le graphique
        </div>
      </div>

      <div className="flex-1 relative min-h-[300px]">
        <svg
          viewBox={`0 0 ${data.W} ${data.H}`}
          className="w-full h-full absolute inset-0 drop-shadow-2xl"
          preserveAspectRatio="none"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <defs>
            <linearGradient id="fillArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={theme.s} stopOpacity="0.4" />
              <stop offset="100%" stopColor={theme.s} stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={theme.s} stopOpacity="0.8" />
              <stop offset="50%" stopColor={theme.s} stopOpacity="1" />
              <stop offset="100%" stopColor={theme.s} stopOpacity="0.8" />
            </linearGradient>

            {/* Glowing effect for the line */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pattern for background grid grid */}
            <pattern id="grid" width={data.W / 10} height={data.H / 5} patternUnits="userSpaceOnUse">
              <path d={`M ${data.W / 10} 0 L 0 0 0 ${data.H / 5}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect x={data.PAD_L} y={data.PAD_T} width={data.W - data.PAD_L - data.PAD_R} height={data.H - data.PAD_T - data.PAD_B} fill="url(#grid)" />

          {/* Zones message (NET uniquement) */}
          {mode === "net" && data.y0 !== null && (
            <>
              <rect
                x={data.PAD_L}
                y={data.PAD_T}
                width={data.W - data.PAD_L - data.PAD_R}
                height={Math.max(0, data.y0 - data.PAD_T)}
                fill="rgba(34,197,94,0.04)"
              />
              <rect
                x={data.PAD_L}
                y={data.y0}
                width={data.W - data.PAD_L - data.PAD_R}
                height={Math.max(0, data.H - data.PAD_B - data.y0)}
                fill="rgba(239,68,68,0.04)"
              />
              {/* Zero line glowing */}
              <line x1={data.PAD_L} y1={data.y0} x2={data.W - data.PAD_R} y2={data.y0} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 4" />
            </>
          )}

          {/* grid + y labels */}
          {data.ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={data.PAD_L}
                y1={t.y}
                x2={data.W - data.PAD_R}
                y2={t.y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <text
                x={data.PAD_L - 14}
                y={t.y + 4}
                textAnchor="end"
                fontSize="11"
                fontWeight="500"
                fill="rgba(236,243,255,0.40)"
              >
                {money(t.v)}
              </text>
            </g>
          ))}

          {/* area + line */}
          <path
            d={data.area}
            fill="url(#fillArea)"
            className="animate-in fade-in duration-1000 origin-bottom"
          />
          <path
            d={data.line}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#neonGlow)"
            className="animate-in fade-in duration-1000"
            style={{ strokeDasharray: 4000, strokeDashoffset: 4000, animation: 'drawPath 2s ease-out forwards' }}
          />

          {/* x labels */}
          {series.map((p, i) => {
            if (i % Math.ceil(series.length / 6) !== 0 && i !== series.length - 1) return null;
            const x = data.pts[i].x;
            return (
              <text
                key={p.key}
                x={x}
                y={data.H - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill="rgba(236,243,255,0.40)"
              >
                {p.label}
              </text>
            );
          })}

          {/* Static Min/Max Dots */}
          {stats?.maxPt && (
            <circle cx={stats.maxPt.x} cy={stats.maxPt.y} r="4" fill="#fff" stroke={theme.s} strokeWidth="2" opacity="0.5" />
          )}
          {stats?.minPt && (
            <circle cx={stats.minPt.x} cy={stats.minPt.y} r="4" fill="#fff" stroke={theme.s} strokeWidth="2" opacity="0.5" />
          )}

          {/* hover crosshair + dot */}
          {hi && (
            <g className="animate-in fade-in duration-150">
              <line
                x1={hi.x}
                y1={data.PAD_T}
                x2={hi.x}
                y2={data.H - data.PAD_B}
                stroke="rgba(255,255,255,0.30)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle cx={hi.x} cy={hi.y} r="8" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <circle cx={hi.x} cy={hi.y} r="5" fill="#fff" filter="url(#neonGlow)" />
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip ultra-premium */}
      {hoverIdx !== null && wrapWidth > 0 && (
        <div
          className="absolute z-50 pointer-events-none transition-all duration-150 ease-out"
          style={{
            width: 280,
            left: clamp(mx + 20, 12, wrapWidth - 300),
            top: clamp(my - 40, 12, wrapHeight - 180),
          }}
        >
          <div className="rounded-2xl border border-white/20 bg-black/60 backdrop-blur-xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-5 relative overflow-hidden">
            {/* Soft background glow reflecting the theme */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[40px] opacity-30" style={{ background: theme.s }}></div>

            <div className="relative z-10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold tracking-wider text-white/50 uppercase">Date</span>
                <span className="font-bold text-white tracking-tight">{series[hoverIdx].key}</span>
              </div>
              <div className="text-sm text-white/70 font-medium mb-4">{series[hoverIdx].label}</div>

              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white/5 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                    <span className="text-sm font-medium text-white/80">Revenus</span>
                  </div>
                  <span className="font-bold text-white">{money(series[hoverIdx].income)}</span>
                </div>

                <div className="flex justify-between items-center bg-white/5 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                    <span className="text-sm font-medium text-white/80">Dépenses</span>
                  </div>
                  <span className="font-bold text-white">{money(series[hoverIdx].expense)}</span>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent my-2"></div>

                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-bold text-white/60 uppercase">Net</span>
                  <span className="font-bold text-lg" style={{ color: series[hoverIdx].net >= 0 ? '#4ade80' : '#f87171', textShadow: `0 0 12px ${series[hoverIdx].net >= 0 ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}` }}>
                    {series[hoverIdx].net > 0 ? '+' : ''}{money(series[hoverIdx].net)}
                  </span>
                </div>
              </div>

              {summary.income > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 text-xs font-medium text-white/50 text-center">
                  Taux d&apos;épargne global estimé: <strong className="text-white">{summary.savingsRate.toFixed(1)}%</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ForecastData {
  run_rate: number;
  projected_expenses: number;
  current_income: number;
  projected_net: number;
  remaining_days: number;
}

export default function DashboardPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [txs, setTxs] = useState<Tx[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [mode, setMode] = useState<"net" | "income" | "expense">("net");
  const [activeDateFilter, setActiveDateFilter] = useState<number | "all">(30);

  const loadAll = React.useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const [t, f] = await Promise.all([getTransactions(), apiFetch("/dashboard/ai-forecast").catch(() => null)]);
      setForecast(f);

      const normalized: Tx[] = t.map((x: Transaction) => {
        const amountNum = Number(x.amount);
        const cat = x.category as Category | undefined;
        return {
          ...x,
          amountNum: Number.isFinite(amountNum) ? amountNum : 0,
          catName: cat?.name ?? "?",
          catType: (cat?.type ?? "expense") as "income" | "expense",
        };
      });

      setTxs(normalized);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        setErr("Tu dois être connecté pour voir le dashboard.");
      } else {
        setErr((e as Error)?.message ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup initial default date range
  useEffect(() => {
    setDateRange(30);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Ajouter un écouteur global pour que l'ajout rapide actualise le Dashboard
  useEffect(() => {
    const handleTxAdded = () => loadAll();
    window.addEventListener('nexledger-tx-added', handleTxAdded);
    return () => window.removeEventListener('nexledger-tx-added', handleTxAdded);
  }, [loadAll]);

  const filteredTxs = useMemo(() => {
    let out = [...txs];
    if (fromDate) out = out.filter((t) => t.date >= fromDate);
    if (toDate) out = out.filter((t) => t.date <= toDate);
    if (typeFilter !== "all") out = out.filter((t) => t.catType === typeFilter);
    out.sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
    return out;
  }, [txs, fromDate, toDate, typeFilter]);

  function setDateRange(days: number | "all") {
    setActiveDateFilter(days);
    if (days === "all") {
      setFromDate("");
      setToDate("");
      return;
    }
    const today = new Date();
    const from = addDays(today, -(days - 1));
    setToDate(ymd(today));
    setFromDate(ymd(from));
  }

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filteredTxs) {
      if (t.catType === "income") income += t.amountNum;
      else expense += t.amountNum;
    }
    const net = income - expense;
    return { income, expense, net, count: filteredTxs.length };
  }, [filteredTxs]);

  const signal = useMemo(() => {
    if (totals.count === 0) return { label: "Aucune donnée", tone: "neutral" as const };
    if (totals.net > 0) return { label: "Excédent", tone: "good" as const };
    if (totals.net < 0) return { label: "Déficit", tone: "bad" as const };
    return { label: "Équilibre", tone: "warn" as const };
  }, [totals]);

  const series = useMemo((): SeriesPoint[] => {
    const m = new Map<string, SeriesPoint>();
    for (const t of filteredTxs) {
      const d = parseYMD(t.date);
      const key = t.date;
      const label = dayLabel(d);
      const cur = m.get(key) ?? { key, label, income: 0, expense: 0, net: 0 };
      if (t.catType === "income") cur.income += t.amountNum;
      else cur.expense += t.amountNum;
      cur.net = cur.income - cur.expense;
      m.set(key, cur);
    }
    const list = Array.from(m.values());
    list.sort((a, b) => a.key.localeCompare(b.key));
    return list;
  }, [filteredTxs]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; type: "income" | "expense"; total: number; count: number; budget_limit?: number }>();
    for (const t of filteredTxs) {
      const k = `${t.catName}__${t.catType}`;
      const cur = map.get(k) ?? {
        name: t.catName,
        type: t.catType,
        total: 0,
        count: 0,
        budget_limit: (t.category as Category | undefined)?.budget_limit ?? undefined
      };
      cur.total += t.amountNum;
      cur.count += 1;
      map.set(k, cur);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    return list;
  }, [filteredTxs]);



  return (
    <main className="space-y-10 pb-16">

      {/* Hero Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-fade-in-up">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="mb-badge bg-blue-500/10 border-blue-500/20 text-blue-300">Dashboard</span>
            <span className="mb-badge">Signal: {signal.label}</span>
            <span className="mb-badge">{fromDate && toDate ? `${fromDate} → ${toDate}` : "Toutes dates"}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-4">Vue rapide</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <BankConnectButton onConnectSuccess={loadAll} />
          <button className="mb-btn gap-2" onClick={loadAll} disabled={loading}>
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
          <Link className="mb-btn mb-btn-primary gap-2" href="/transactions">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Gérer transactions
          </Link>
        </div>
      </section>

      {/* Error */}
      {err && (
        <div className="rounded-2xl p-5 border border-red-500/30 bg-red-500/10 animate-fade-in-up">
          <div className="font-semibold text-red-100">Erreur</div>
          <div className="text-sm opacity-80 mt-1 text-red-200">{err}</div>
          <div className="mt-4">
            <Link className="mb-btn mb-btn-primary" href="/login">Se connecter</Link>
          </div>
        </div>
      )}

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-4 animate-fade-in-up delay-100">
        <KPI label="Revenus" value={money(totals.income)} hint="selon filtres" tone="good" />
        <KPI label="Dépenses" value={money(totals.expense)} hint="selon filtres" tone="warn" />
        <KPI label="Net" value={money(totals.net)} hint={`Signal: ${signal.label}`} tone={signal.tone} />
        <KPI label="Transactions" value={num(totals.count)} hint="dans la période" tone="neutral" />
      </section>

      {/* Quick Date Filters */}
      <section className="rounded-2xl bg-black/30 border border-white/[0.06] p-4 animate-fade-in-up delay-150">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-semibold opacity-50 shrink-0 uppercase tracking-widest">Période</span>
          <div className="flex flex-wrap gap-2">
            {([30, 60, 90, "all"] as const).map((d) => {
              const active = activeDateFilter === d;
              return (
                <button
                  key={String(d)}
                  onClick={() => setDateRange(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    active
                      ? "bg-white/12 text-white border-white/25 shadow-[0_0_10px_rgba(255,255,255,0.06)]"
                      : "bg-transparent text-white/40 border-white/8 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  {d === "all" ? "Tout" : `${d}j`}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Forecast */}
      {forecast && (
        <section className="rounded-2xl p-7 relative overflow-hidden bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.10)] animate-fade-in-up delay-200">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/12 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/12 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-white/8 rounded-xl border border-indigo-500/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent">
                  Nexus IA — Prévision Cash-Flow
                </h2>
                <p className="text-xs opacity-50 mt-0.5">{money(forecast.run_rate)}/jour · {forecast.remaining_days} jours restants</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-5 bg-black/30 rounded-xl border border-white/[0.06]">
                <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Dépenses Projetées</div>
                <div className="text-2xl font-bold mt-2">{money(forecast.projected_expenses)}</div>
                <div className="text-xs opacity-40 mt-1">D&apos;ici fin du mois</div>
              </div>
              <div className="p-5 bg-black/30 rounded-xl border border-white/[0.06]">
                <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Revenus Confirmés</div>
                <div className="text-2xl font-bold mt-2">{money(forecast.current_income)}</div>
                <div className="text-xs opacity-40 mt-1">Acquis ce mois-ci</div>
              </div>
              <div className={`p-5 rounded-xl border ${forecast.projected_net >= 0 ? "border-green-500/25 bg-green-500/8" : "border-red-500/25 bg-red-500/8"}`}>
                <div className={`text-xs font-semibold uppercase tracking-wider ${forecast.projected_net >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Solde Prévu
                </div>
                <div className={`text-2xl font-bold mt-2 ${forecast.projected_net >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {forecast.projected_net > 0 ? "+" : ""}{money(forecast.projected_net)}
                </div>
                <div className="text-xs opacity-60 mt-1">
                  {forecast.projected_net >= 0 ? "Excellent rythme !" : `Risque déficit dans ${forecast.remaining_days}j`}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Advanced Filters + Chart */}
      <section className="grid gap-6 lg:grid-cols-12 animate-fade-in-up delay-300">
        <div className="lg:col-span-4 rounded-2xl bg-black/30 border border-white/[0.06] p-5">
          <div className="text-xs font-semibold opacity-50 uppercase tracking-widest mb-4">Filtres avancés</div>
          <div className="grid gap-3">
            <label className="text-sm opacity-70">
              Début
              <input className="mb-input mt-1.5" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="text-sm opacity-70">
              Fin
              <input className="mb-input mt-1.5" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <label className="text-sm opacity-70">
              Type
              <select className="mb-input mt-1.5" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}>
                <option value="all">Tous</option>
                <option value="income">Revenus</option>
                <option value="expense">Dépenses</option>
              </select>
            </label>
            <label className="text-sm opacity-70">
              Graphique
              <select className="mb-input mt-1.5" value={mode} onChange={(e) => setMode(e.target.value as "net" | "income" | "expense")}>
                <option value="net">Net</option>
                <option value="income">Revenus</option>
                <option value="expense">Dépenses</option>
              </select>
            </label>
            <button
              className="mb-btn w-full mt-1"
              onClick={() => { setDateRange("all"); setTypeFilter("all"); setMode("net"); }}
            >
              Réinitialiser
            </button>
          </div>
        </div>
        <div className="lg:col-span-8">
          <TrendChart series={series} mode={mode} />
        </div>
      </section>

      {/* Budget Alerts */}
      {(() => {
        const alerts = byCategory.filter(c => {
          if (c.type !== "expense" || !c.budget_limit) return false;
          const pct = (Math.abs(c.total) / c.budget_limit) * 100;
          return pct >= 80;
        });

        if (alerts.length === 0) return null;

        return (
          <section className="animate-fade-in-up delay-300">
            <div className="rounded-2xl bg-black/30 border border-white/[0.06] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">Alertes Budget</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {alerts.map((a, i) => {
                  const pct = Math.min((Math.abs(a.total) / (a.budget_limit || 1)) * 100, 100);
                  const isCritical = pct >= 100;
                  return (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-md ${isCritical ? 'bg-red-500/10 border-red-500/30 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-orange-500/10 border-orange-500/30 text-orange-100'}`}>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {a.name}
                          {isCritical && <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-red-500 text-white">Dépassement</span>}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {money(Math.abs(a.total))} / {money(a.budget_limit || 0)} ({pct.toFixed(0)}%)
                        </div>
                      </div>
                      <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-sm ${isCritical ? 'border-red-500 text-red-400' : 'border-orange-500 text-orange-400'}`}>
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Budget & Categories */}
      <section className="rounded-2xl bg-black/30 border border-white/[0.06] p-6 animate-fade-in-up delay-400">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-base font-semibold">Budgets &amp; Catégories</div>
            <div className="text-xs opacity-50 mt-0.5">Suivi de la consommation par catégorie</div>
          </div>
          <span className="mb-badge">{byCategory.length} catégorie(s)</span>
        </div>

        {byCategory.length > 0 && (
          <div className="mb-6 flex justify-center">
            <DonutChart
              data={byCategory.slice(0, 8).map((c, i) => {
                const palette = ["#6366f1","#eab308","#ef4444","#06b6d4","#f97316","#8b5cf6","#10b981","#ec4899"];
                return {
                  id: i,
                  label: c.name,
                  value: Math.abs(c.total),
                  color: c.type === "income" ? "#22c55e" : palette[i % palette.length],
                };
              })}
              centerTextTop="Top 8"
              centerTextBottom={money(byCategory.slice(0, 8).reduce((acc, c) => acc + Math.abs(c.total), 0))}
            />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {byCategory.map((c, idx) => {
            const consumed = Math.abs(c.total);
            const limit = c.budget_limit || 0;
            const hasLimit = limit > 0 && c.type === "expense";
            let w = 0;
            if (hasLimit) {
              w = Math.min((consumed / limit) * 100, 100);
            } else {
              const max = Math.max(...byCategory.map((x) => Math.abs(x.total)), 1);
              w = (consumed / max) * 100;
            }
            let barColor = "rgba(234,179,8,0.5)";
            if (c.type === "income") barColor = "rgba(34,197,94,0.6)";
            else if (hasLimit) {
              barColor = w >= 90 ? "rgba(239,68,68,0.7)" : w >= 75 ? "rgba(234,179,8,0.7)" : "rgba(34,197,94,0.7)";
            }
            return (
              <div key={idx} className="rounded-2xl p-5 bg-black/30 border border-white/5 hover:border-white/10 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs opacity-50 mt-0.5 uppercase tracking-wider">
                      {c.type === "income" ? "Revenus" : "Dépenses"} · {num(c.count)} tx
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-lg">{money(consumed)}</div>
                    {hasLimit && (
                      <div className="text-xs opacity-50 mt-0.5">/ {money(limit)}</div>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${w}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
                  />
                </div>
                {hasLimit && (
                  <div className="mt-1.5 text-xs opacity-40 text-right">{w.toFixed(0)}% utilisé</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
