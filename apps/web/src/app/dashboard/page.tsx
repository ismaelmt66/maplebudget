"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  getTransactions,
  Category,
  Transaction,
  apiFetch,
  getFinancialHealthScore,
  HealthScore,
  getWeeklyReport,
  WeeklyReport,
  getAssets,
  Asset,
  getSubscriptions,
  Subscription,
} from "@/lib/api";
import BankConnectButton from "@/components/BankConnectButton";
import { money, ymd, addDays, parseYMD } from "@/lib/format";
import { DonutChart } from "@/components/DashboardDonut";

const LOCALE = "fr-CA";

type Tx = Transaction & {
  amountNum: number;
  catName: string;
  catType: "income" | "expense";
};

type SeriesPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

function num(n: number) {
  return new Intl.NumberFormat(LOCALE).format(n);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function dayLabel(d: Date) {
  return d.toLocaleDateString(LOCALE, { month: "short", day: "2-digit" });
}

/**
 * Estimates approximate years to financial independence from savings rate alone.
 *
 * Based on the "Shockingly Simple Math" formula (Mr. Money Mustache):
 *   years = log(1 + FI_multiple × r / spending_ratio) / log(1 + r)
 *
 * Assumptions:
 *   - r = 0.05 (5% real annual investment return after inflation)
 *   - FI_multiple = 25 (4% Safe Withdrawal Rate → 25× annual expenses)
 *   - spending_ratio = (1 − s) / s  where s = savings rate (0–1)
 *   - Starts from zero net worth (conservative; actual FI arrival is sooner with assets)
 *
 * Edge cases:
 *   - savingsRatePct ≤ 0  → returns null  (can never reach FI)
 *   - savingsRatePct ≥ 100 → returns 0   (already FI if all income is saved)
 *
 * @param savingsRatePct - Savings rate as a percentage (e.g. 25 for 25%)
 * @returns Estimated years to FI, or null if unachievable
 */
function yearsToFI(savingsRatePct: number): number | null {
  if (savingsRatePct <= 0) return null;
  if (savingsRatePct >= 100) return 0;
  const s = savingsRatePct / 100;
  const r = 0.05; // 5% real return
  const fiMultiple = 25; // 4% SWR ⟹ 25× annual expenses
  const spendingRatio = (1 - s) / s;
  const years = Math.log(1 + (fiMultiple * r) / spendingRatio) / Math.log(1 + r);
  return Math.max(0, years);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  KPI tile                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function KPI({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
  icon?: React.ReactNode;
}) {
  const toneStyle =
    tone === "good"
      ? { borderColor: "rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.08)" }
      : tone === "bad"
        ? { borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)" }
        : tone === "warn"
          ? { borderColor: "rgba(234,179,8,0.25)", background: "rgba(234,179,8,0.08)" }
          : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" };

  return (
    <div
      className="rounded-2xl p-4 border transition-all duration-200 hover:-translate-y-0.5"
      style={toneStyle as React.CSSProperties}
    >
      {icon && <div className="mb-2 opacity-60">{icon}</div>}
      <div className="text-xs text-white/50 font-medium tracking-wide uppercase">{label}</div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
      {hint && <div className="text-xs text-white/40 mt-1.5">{hint}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Decision Engine card                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

function DecisionCard({
  icon,
  title,
  description,
  impact,
  cta,
  href,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  impact: string;
  cta: string;
  href: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const colors = {
    good: {
      border: "rgba(34,197,94,0.25)",
      bg: "rgba(34,197,94,0.06)",
      accent: "#22c55e",
      btn: "rgba(34,197,94,0.2)",
    },
    warn: {
      border: "rgba(234,179,8,0.25)",
      bg: "rgba(234,179,8,0.06)",
      accent: "#eab308",
      btn: "rgba(234,179,8,0.2)",
    },
    bad: {
      border: "rgba(239,68,68,0.25)",
      bg: "rgba(239,68,68,0.06)",
      accent: "#ef4444",
      btn: "rgba(239,68,68,0.2)",
    },
    neutral: {
      border: "rgba(99,102,241,0.25)",
      bg: "rgba(99,102,241,0.06)",
      accent: "#818cf8",
      btn: "rgba(99,102,241,0.2)",
    },
  }[tone];

  return (
    <div
      className="rounded-2xl p-5 border flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      style={{ borderColor: colors.border, background: colors.bg }}
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl shrink-0" style={{ background: colors.btn }}>
          <div style={{ color: colors.accent }}>{icon}</div>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-tight">{title}</div>
          <div className="text-xs text-white/50 mt-1 leading-relaxed">{description}</div>
        </div>
      </div>
      <div
        className="rounded-xl px-3 py-2 bg-black/20 border border-white/5 text-xs font-medium"
        style={{ color: colors.accent }}
      >
        💡 {impact}
      </div>
      <Link
        href={href}
        className="mt-auto text-xs font-semibold py-2.5 px-4 rounded-xl text-center transition-all duration-150 hover:brightness-110"
        style={{ background: colors.btn, color: colors.accent, border: `1px solid ${colors.border}` }}
      >
        {cta} →
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  FI Progress strip                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function FIProgressStrip({
  savingsRatePct,
  monthlyNet,
}: {
  savingsRatePct: number;
  monthlyNet: number;
}) {
  const years = yearsToFI(savingsRatePct);
  const hasData = savingsRatePct > 0 && monthlyNet > 0;
  const progressPct =
    years !== null ? Math.min(100, Math.max(0, (1 - years / 50) * 100)) : 0;
  const label =
    years === null
      ? "Taux d'épargne insuffisant"
      : years === 0
        ? "🎉 Indépendance financière atteinte !"
        : `Indépendance financière estimée dans ${Math.ceil(years)} ans`;
  const color = !hasData
    ? "rgba(255,255,255,0.2)"
    : years !== null && years <= 20
      ? "#22c55e"
      : years !== null && years <= 35
        ? "#eab308"
        : "#ef4444";

  return (
    <div className="rounded-2xl p-5 bg-black/30 border border-white/[0.06] space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <span className="text-sm font-semibold">
            Progression vers l&apos;Indépendance Financière
          </span>
        </div>
        {hasData && years !== null && (
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${color}20`, color }}
          >
            {Math.ceil(years)} ans
          </span>
        )}
      </div>
      <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 10px ${color}60`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/40 flex-wrap gap-1">
        <span>{label}</span>
        {hasData && (
          <span>
            Taux d&apos;épargne:{" "}
            <strong className="text-white/70">{savingsRatePct.toFixed(1)}%</strong>
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  TrendChart                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

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
    return { income, expense, net, ratio, status };
  }, [series]);

  const data = useMemo(() => {
    if (series.length < 2) return null;
    const W = 1000,
      H = 360,
      PAD_L = 54,
      PAD_R = 24,
      PAD_T = 26,
      PAD_B = 38;
    const values = series.map((p) =>
      mode === "income" ? p.income : mode === "expense" ? p.expense : p.net
    );
    let min = Math.min(...values),
      max = Math.max(...values);
    if (min === max) {
      if (max === 0) {
        min = -100;
        max = 100;
      } else {
        const m = Math.abs(max) * 0.2 || 10;
        min -= m;
        max += m;
      }
    }
    const span = max - min || 1;
    min -= span * 0.12;
    max += span * 0.12;
    const realSpan = max - min;
    const xStep = (W - PAD_L - PAD_R) / (values.length - 1);
    const pts = values.map((v, i) => ({
      x: PAD_L + i * xStep,
      y: PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / realSpan),
      v,
      i,
    }));
    const line = pts.reduce((acc, p, i, a) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = a[i - 1];
      const cp1x = prev.x + (p.x - prev.x) / 2;
      return `${acc} C ${cp1x},${prev.y} ${cp1x},${p.y} ${p.x},${p.y}`;
    }, "");
    const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;
    const y0 =
      mode === "net"
        ? Math.min(
            Math.max(
              PAD_T + (H - PAD_T - PAD_B) * (1 - (0 - min) / realSpan),
              PAD_T
            ),
            H - PAD_B
          )
        : null;
    const ticks = Array.from({ length: 5 }, (_, i) => ({
      v: max - (i / 4) * (max - min),
      y: PAD_T + (H - PAD_T - PAD_B) * (i / 4),
    }));
    return { W, H, PAD_L, PAD_R, PAD_T, PAD_B, pts, min, max, line, area, ticks, y0 };
  }, [series, mode]);

  const theme = useMemo(() => {
    if (mode === "income") return { s: "rgba(34,197,94,0.90)" };
    if (mode === "expense") return { s: "rgba(234,179,8,0.90)" };
    if (summary.status === "healthy") return { s: "rgba(34,197,94,0.90)" };
    if (summary.status === "watch") return { s: "rgba(234,179,8,0.90)" };
    if (summary.status === "risk") return { s: "rgba(239,68,68,0.90)" };
    return { s: "rgba(96,165,250,0.90)" };
  }, [mode, summary.status]);

  const stats = useMemo(() => {
    if (!data || data.pts.length === 0) return null;
    const vals = data.pts.map((p) => p.v);
    const minVal = Math.min(...vals),
      maxVal = Math.max(...vals);
    const avgVal = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      minVal,
      maxVal,
      avgVal,
      maxPt: data.pts.find((p) => p.v === maxVal),
      minPt: data.pts.find((p) => p.v === minVal),
    };
  }, [data]);

  function clearHideTimer() {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }
  function scheduleHide() {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => setHoverIdx(null), 160);
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!data) return;
    clearHideTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    if (wrapRef.current) {
      setWrapWidth(wrapRef.current.clientWidth);
      setWrapHeight(wrapRef.current.clientHeight);
    }
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    const vx = (x / rect.width) * data.W;
    if (vx < data.PAD_L - 6 || vx > data.W - data.PAD_R + 6) {
      scheduleHide();
      return;
    }
    let best = 0,
      bestDist = Infinity;
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

  if (!data)
    return (
      <div className="text-sm opacity-70 p-6 flex justify-center">
        Pas assez de données pour afficher le graphique.
      </div>
    );

  const hi = hoverIdx !== null ? data.pts[hoverIdx] : null;
  const statusLabel =
    summary.status === "healthy"
      ? "Sain"
      : summary.status === "watch"
        ? "Surveillance"
        : summary.status === "risk"
          ? "Risque"
          : "—";

  return (
    <div
      className="chart-shell p-4 md:p-6 relative rounded-3xl bg-black/40 border border-white/5 backdrop-blur-md shadow-2xl h-full flex flex-col"
      ref={wrapRef}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">
              Évolution{" "}
              {mode === "net"
                ? "Nette"
                : mode === "income"
                  ? "des Revenus"
                  : "des Dépenses"}
            </h3>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/10"
              style={{ color: theme.s }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="text-xs opacity-60 mt-1.5 flex gap-4 flex-wrap">
            {stats && (
              <>
                <span>
                  Moy. <strong className="text-white">{money(stats.avgVal)}</strong>
                </span>
                <span>
                  Max. <strong className="text-white">{money(stats.maxVal)}</strong>
                </span>
              </>
            )}
            {summary.income > 0 && (
              <span className="opacity-50">
                | Dépenses/Revenus: {Math.round(summary.ratio * 100)}%
              </span>
            )}
          </div>
        </div>
        <div className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 animate-pulse hidden sm:block">
          Survolez
        </div>
      </div>
      <div className="flex-1 relative min-h-[260px]">
        <svg
          viewBox={`0 0 ${data.W} ${data.H}`}
          className="w-full h-full absolute inset-0"
          preserveAspectRatio="none"
          onMouseMove={onMove}
          onMouseLeave={scheduleHide}
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
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern
              id="grid"
              width={data.W / 10}
              height={data.H / 5}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${data.W / 10} 0 L 0 0 0 ${data.H / 5}`}
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect
            x={data.PAD_L}
            y={data.PAD_T}
            width={data.W - data.PAD_L - data.PAD_R}
            height={data.H - data.PAD_T - data.PAD_B}
            fill="url(#grid)"
          />
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
              <line
                x1={data.PAD_L}
                y1={data.y0}
                x2={data.W - data.PAD_R}
                y2={data.y0}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            </>
          )}
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
          <path d={data.area} fill="url(#fillArea)" />
          <path
            d={data.line}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#neonGlow)"
            style={{
              strokeDasharray: 4000,
              strokeDashoffset: 4000,
              animation: "drawPath 2s ease-out forwards",
            }}
          />
          {series.map((p, i) => {
            if (i % Math.ceil(series.length / 6) !== 0 && i !== series.length - 1)
              return null;
            return (
              <text
                key={p.key}
                x={data.pts[i].x}
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
          {stats?.maxPt && (
            <circle
              cx={stats.maxPt.x}
              cy={stats.maxPt.y}
              r="4"
              fill="#fff"
              stroke={theme.s}
              strokeWidth="2"
              opacity="0.5"
            />
          )}
          {stats?.minPt && (
            <circle
              cx={stats.minPt.x}
              cy={stats.minPt.y}
              r="4"
              fill="#fff"
              stroke={theme.s}
              strokeWidth="2"
              opacity="0.5"
            />
          )}
          {hi && (
            <g>
              <line
                x1={hi.x}
                y1={data.PAD_T}
                x2={hi.x}
                y2={data.H - data.PAD_B}
                stroke="rgba(255,255,255,0.30)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle
                cx={hi.x}
                cy={hi.y}
                r="8"
                fill="rgba(0,0,0,0.8)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
              />
              <circle cx={hi.x} cy={hi.y} r="5" fill="#fff" filter="url(#neonGlow)" />
            </g>
          )}
        </svg>
      </div>
      {hoverIdx !== null && wrapWidth > 0 && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            width: 250,
            left: clamp(mx + 16, 8, wrapWidth - 262),
            top: clamp(my - 40, 8, wrapHeight - 160),
          }}
        >
          <div className="rounded-2xl border border-white/20 bg-black/70 backdrop-blur-xl shadow-2xl p-4 relative overflow-hidden">
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[30px] opacity-25"
              style={{ background: theme.s }}
            />
            <div className="relative z-10 space-y-2 text-sm">
              <div className="text-white/50 text-xs font-semibold">
                {series[hoverIdx].key}
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Revenus
                </span>
                <span className="font-bold">{money(series[hoverIdx].income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                  Dépenses
                </span>
                <span className="font-bold">{money(series[hoverIdx].expense)}</span>
              </div>
              <div className="h-px bg-white/10 my-1" />
              <div className="flex justify-between font-bold">
                <span className="text-white/70">Net</span>
                <span
                  style={{
                    color: series[hoverIdx].net >= 0 ? "#4ade80" : "#f87171",
                  }}
                >
                  {series[hoverIdx].net > 0 ? "+" : ""}
                  {money(series[hoverIdx].net)}
                </span>
              </div>
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

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DashboardPage                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function DashboardPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [txs, setTxs] = useState<Tx[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [mode, setMode] = useState<"net" | "income" | "expense">("net");
  const [activeDateFilter, setActiveDateFilter] = useState<number | "all">(30);

  const loadAll = React.useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const [t, f, hs, wr, a, subs] = await Promise.all([
        getTransactions(),
        apiFetch("/dashboard/ai-forecast").catch(() => null),
        getFinancialHealthScore().catch(() => null),
        getWeeklyReport().catch(() => null),
        getAssets().catch(() => []),
        getSubscriptions().catch(() => []),
      ]);
      setForecast(f as ForecastData | null);
      setHealthScore(hs as HealthScore | null);
      setWeeklyReport(wr as WeeklyReport | null);
      setAssets(a as Asset[]);
      setSubscriptions(subs as Subscription[]);
      const normalized: Tx[] = (t as Transaction[]).map((x) => {
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
      if (e instanceof ApiError && e.status === 401)
        setErr("Tu dois être connecté pour voir le dashboard.");
      else setErr((e as Error)?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDateRange(30);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadAll();
  }, [loadAll]);
  useEffect(() => {
    const h = () => loadAll();
    window.addEventListener("nexledger-tx-added", h);
    return () => window.removeEventListener("nexledger-tx-added", h);
  }, [loadAll]);

  const filteredTxs = useMemo(() => {
    let out = [...txs];
    if (fromDate) out = out.filter((t) => t.date >= fromDate);
    if (toDate) out = out.filter((t) => t.date <= toDate);
    if (typeFilter !== "all") out = out.filter((t) => t.catType === typeFilter);
    out.sort(
      (a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)
    );
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
    setToDate(ymd(today));
    setFromDate(ymd(addDays(today, -(days - 1))));
  }

  const totals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const t of filteredTxs) {
      if (t.catType === "income") income += t.amountNum;
      else expense += t.amountNum;
    }
    return { income, expense, net: income - expense, count: filteredTxs.length };
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
      const key = t.date;
      const cur = m.get(key) ?? {
        key,
        label: dayLabel(parseYMD(t.date)),
        income: 0,
        expense: 0,
        net: 0,
      };
      if (t.catType === "income") cur.income += t.amountNum;
      else cur.expense += t.amountNum;
      cur.net = cur.income - cur.expense;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredTxs]);

  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        type: "income" | "expense";
        total: number;
        count: number;
        budget_limit?: number;
      }
    >();
    for (const t of filteredTxs) {
      const k = `${t.catName}__${t.catType}`;
      const cur = map.get(k) ?? {
        name: t.catName,
        type: t.catType,
        total: 0,
        count: 0,
        budget_limit:
          (t.category as Category | undefined)?.budget_limit ?? undefined,
      };
      cur.total += t.amountNum;
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => Math.abs(b.total) - Math.abs(a.total)
    );
  }, [filteredTxs]);

  // Computed financial metrics
  const daysInPeriod =
    activeDateFilter === "all" ? 30 : (activeDateFilter as number);
  const monthlyIncome = (totals.income / daysInPeriod) * 30;
  const monthlyBurnRate = (totals.expense / daysInPeriod) * 30;
  const savingsRatePct =
    totals.income > 0 ? (totals.net / totals.income) * 100 : 0;
  const netWorth = assets.reduce((sum, a) => sum + a.balance, 0);
  // Cash runway: how many days of expenses can be covered by current net worth (assets)
  // Falls back to period net flow when no assets are recorded
  const cashRunwayDays =
    monthlyBurnRate > 0
      ? Math.max(
          0,
          netWorth > 0
            ? Math.floor((netWorth / monthlyBurnRate) * 30)
            : totals.net > 0
              ? Math.floor((totals.net / monthlyBurnRate) * 30)
              : 0
        )
      : 0;

  // Decision Engine
  type DecisionItem = {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    impact: string;
    cta: string;
    href: string;
    tone: "good" | "warn" | "bad" | "neutral";
  };

  const decisions = useMemo((): DecisionItem[] => {
    const cards: DecisionItem[] = [];

    // 1. Low savings rate
    if (savingsRatePct < 20 && totals.income > 0) {
      const extraSavings = Math.round(monthlyIncome * 0.05);
      const yfi = yearsToFI(savingsRatePct + 5);
      const yCurrent = yearsToFI(savingsRatePct);
      const gain =
        yCurrent !== null && yfi !== null ? Math.ceil(yCurrent - yfi) : null;
      cards.push({
        id: "savings",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        ),
        title: "Augmenter votre taux d'épargne",
        description: `Votre taux d'épargne est de ${savingsRatePct.toFixed(1)}%. L'objectif recommandé est ≥ 20%.`,
        impact: gain
          ? `Épargner ${money(extraSavings)}/mois de plus accélère votre retraite de ~${gain} ans`
          : `Épargner ${money(extraSavings)}/mois améliore votre trajectoire`,
        cta: "Simuler l'impact",
        href: "/planification/simulator",
        tone: savingsRatePct < 5 ? "bad" : "warn",
      });
    }

    // 2. Budget exceeded
    const exceededCats = byCategory.filter(
      (c) =>
        c.type === "expense" && c.budget_limit && Math.abs(c.total) > c.budget_limit
    );
    if (exceededCats.length > 0) {
      const worst = exceededCats[0];
      const overspend = Math.abs(worst.total) - (worst.budget_limit || 0);
      cards.push({
        id: "budget",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        title: `Réduire: ${worst.name}`,
        description: `Vous dépassez le budget "${worst.name}" de ${money(overspend)}.${exceededCats.length > 1 ? ` +${exceededCats.length - 1} autre(s).` : ""}`,
        impact: `Réduire économise ${money(overspend)}/mois → ${money(overspend * 12)}/an`,
        cta: "Gérer les budgets",
        href: "/finances/budget",
        tone: "bad",
      });
    }

    // 3. Emergency fund
    if (healthScore && healthScore.breakdown.emergency_fund < 12) {
      cards.push({
        id: "emergency",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        title: "Constituer un fonds d'urgence",
        description:
          "Votre fonds d'urgence est insuffisant. Objectif: 3–6 mois de dépenses.",
        impact: `Objectif: ${money(monthlyBurnRate * 3)} (3 mois) → sécurité accrue`,
        cta: "Créer un objectif",
        href: "/planification/goals",
        tone: "warn",
      });
    }

    // 4. Subscription waste
    const expensiveSubs = subscriptions.filter((s) => s.monthly_cost > 20);
    if (expensiveSubs.length > 0) {
      const totalSubs = expensiveSubs.reduce((sum, s) => sum + s.monthly_cost, 0);
      cards.push({
        id: "subscriptions",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        ),
        title: "Optimiser vos abonnements",
        description: `${expensiveSubs.length} abonnement(s) pour ${money(totalSubs)}/mois détectés.`,
        impact: `Annuler 1 abonnement = ${money(expensiveSubs[0].monthly_cost * 12)}/an récupérés`,
        cta: "Analyser les abonnements",
        href: "/insights/reports",
        tone: "neutral",
      });
    }

    // 5. Invest more (when savings rate is good)
    if (savingsRatePct >= 20 && totals.income > 0 && cards.length < 3) {
      const extraInvest = Math.round(monthlyIncome * 0.05);
      cards.push({
        id: "invest",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        ),
        title: "Optimiser vos investissements",
        description:
          "Bon taux d'épargne ! Investir davantage accélère votre indépendance financière.",
        impact: `Investir ${money(extraInvest)}/mois de plus avance votre retraite`,
        cta: "Simuler la projection",
        href: "/planification/simulator",
        tone: "good",
      });
    }

    return cards.slice(0, 3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savingsRatePct, totals.income, byCategory, healthScore, subscriptions, monthlyIncome, monthlyBurnRate]);

  const budgetAlerts = byCategory.filter((c) => {
    if (c.type !== "expense" || !c.budget_limit) return false;
    return (Math.abs(c.total) / c.budget_limit) * 100 >= 80;
  });

  return (
    <main className="mb-container space-y-6 pb-16">
      {/* ══════════════════════════════════════════════════════ HEADER */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Tableau de Bord
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {fromDate && toDate
              ? `${fromDate} → ${toDate}`
              : "Toutes les périodes"}
            {" · "}
            {num(totals.count)} transaction(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl p-1">
            {([30, 60, 90, "all"] as const).map((d) => (
              <button
                key={String(d)}
                onClick={() => setDateRange(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeDateFilter === d
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {d === "all" ? "Tout" : `${d}j`}
              </button>
            ))}
          </div>
          <button
            className="mb-btn gap-2"
            onClick={loadAll}
            disabled={loading}
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? "..." : "Actualiser"}
          </button>
          <BankConnectButton onConnectSuccess={loadAll} />
        </div>
      </section>

      {err && (
        <div className="rounded-2xl p-5 border border-red-500/30 bg-red-500/10 animate-fade-in-up">
          <div className="font-semibold text-red-100">Erreur de chargement</div>
          <div className="text-sm opacity-80 mt-1 text-red-200">{err}</div>
          <div className="mt-4">
            <Link className="mb-btn mb-btn-primary" href="/login">
              Se connecter
            </Link>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ LAYER 1: FINANCIAL SNAPSHOT */}
      <section className="animate-fade-in-up delay-100 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">
            Couche 1 — Snapshot Financier
          </h2>
        </div>

        {/* Hero card */}
        <div
          className="relative rounded-3xl overflow-hidden border p-6 sm:p-8"
          style={{
            borderColor:
              totals.net >= 0
                ? "rgba(34,197,94,0.25)"
                : "rgba(239,68,68,0.25)",
            background:
              totals.net >= 0
                ? "linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(16,185,129,0.05) 100%)"
                : "linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.05) 100%)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none"
            style={{
              background: totals.net >= 0 ? "#22c55e" : "#ef4444",
              transform: "translate(30%, -30%)",
            }}
          />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="text-sm font-semibold text-white/50 mb-2 uppercase tracking-widest">
                {netWorth > 0 ? "Patrimoine Net" : "Flux Net de Trésorerie"}
              </div>
              <div className="text-5xl sm:text-6xl font-black tracking-tight leading-none">
                {netWorth > 0
                  ? money(netWorth)
                  : (totals.net >= 0 ? "+" : "") + money(totals.net)}
              </div>
              {netWorth > 0 && (
                <div className="mt-2 text-sm text-white/50">
                  Flux net:{" "}
                  <span
                    className={
                      totals.net >= 0
                        ? "text-green-400 font-semibold"
                        : "text-red-400 font-semibold"
                    }
                  >
                    {totals.net >= 0 ? "+" : ""}
                    {money(totals.net)}
                  </span>{" "}
                  sur la période
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    signal.tone === "good"
                      ? "bg-green-500/15 text-green-300 border-green-500/25"
                      : signal.tone === "bad"
                        ? "bg-red-500/15 text-red-300 border-red-500/25"
                        : "bg-yellow-500/15 text-yellow-300 border-yellow-500/25"
                  }`}
                >
                  {signal.label}
                </span>
                {savingsRatePct !== 0 && (
                  <span className="text-xs text-white/40">
                    Taux d&apos;épargne:{" "}
                    <strong
                      className={
                        savingsRatePct >= 20
                          ? "text-green-400"
                          : savingsRatePct >= 10
                            ? "text-yellow-400"
                            : "text-red-400"
                      }
                    >
                      {savingsRatePct.toFixed(1)}%
                    </strong>
                  </span>
                )}
              </div>
            </div>
            {healthScore && (
              <div className="shrink-0 flex flex-col items-center gap-1">
                <svg width="88" height="88" viewBox="0 0 88 88">
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    fill="none"
                    stroke={
                      healthScore.score >= 70
                        ? "#22c55e"
                        : healthScore.score >= 40
                          ? "#f59e0b"
                          : "#ef4444"
                    }
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(healthScore.score / 100) * 226.2} 226.2`}
                    transform="rotate(-90 44 44)"
                    style={{ transition: "stroke-dasharray 1.2s ease" }}
                  />
                  <text
                    x="44"
                    y="48"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="800"
                    fill="white"
                    dominantBaseline="middle"
                  >
                    {healthScore.score}
                  </text>
                  <text
                    x="44"
                    y="61"
                    textAnchor="middle"
                    fontSize="10"
                    fill="rgba(255,255,255,0.4)"
                  >
                    {healthScore.grade}
                  </text>
                </svg>
                <div className="text-[11px] text-white/40 font-semibold uppercase tracking-wider -mt-1">
                  Santé Fin.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4 KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI
            label="Revenus"
            value={money(totals.income)}
            hint={`~${money(monthlyIncome)}/mois`}
            tone="good"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            }
          />
          <KPI
            label="Dépenses"
            value={money(totals.expense)}
            hint={`Burn: ~${money(monthlyBurnRate)}/mois`}
            tone="warn"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            }
          />
          <KPI
            label="Taux d'épargne"
            value={totals.income > 0 ? `${savingsRatePct.toFixed(1)}%` : "—"}
            hint={
              savingsRatePct >= 20
                ? "Excellent !"
                : savingsRatePct >= 10
                  ? "Peut mieux faire"
                  : totals.income > 0
                    ? "À améliorer"
                    : "Données insuffisantes"
            }
            tone={
              savingsRatePct >= 20
                ? "good"
                : savingsRatePct >= 10
                  ? "warn"
                  : totals.income > 0
                    ? "bad"
                    : "neutral"
            }
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            }
          />
          <KPI
            label="Runway"
            value={cashRunwayDays > 0 ? `${cashRunwayDays}j` : "—"}
            hint={
              cashRunwayDays > 90
                ? "Confortable"
                : cashRunwayDays > 30
                  ? "Attention"
                  : cashRunwayDays > 0
                    ? "Critique"
                    : "Données insuffisantes"
            }
            tone={
              cashRunwayDays > 90
                ? "good"
                : cashRunwayDays > 30
                  ? "warn"
                  : cashRunwayDays > 0
                    ? "bad"
                    : "neutral"
            }
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ══════════════════════════════════════ LAYER 2: TRAJECTORY */}
      <section className="animate-fade-in-up delay-200 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-purple-400 to-indigo-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">
              Couche 2 — Trajectoire Financière
            </h2>
          </div>
          <div className="flex gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl p-1">
            {(["net", "income", "expense"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mode === m
                    ? "bg-white/15 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {m === "net" ? "Net" : m === "income" ? "Revenus" : "Dépenses"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Main Trend Chart */}
          <div className="lg:col-span-8">
            <TrendChart series={series} mode={mode} />
          </div>

          {/* Forecast + Health Score */}
          <div className="lg:col-span-4 space-y-4">
            {forecast ? (
              <div className="rounded-2xl p-5 relative overflow-hidden bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-500/20">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-indigo-400"
                      >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-indigo-200">
                        Prévision IA
                      </div>
                      <div className="text-[10px] text-white/40">
                        {forecast.remaining_days}j restants · {money(forecast.run_rate)}/j
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Dépenses projetées</span>
                      <span className="text-sm font-bold">
                        {money(forecast.projected_expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Revenus confirmés</span>
                      <span className="text-sm font-bold text-green-400">
                        {money(forecast.current_income)}
                      </span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white/70">
                        Solde prévu
                      </span>
                      <span
                        className={`text-base font-black ${
                          forecast.projected_net >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {forecast.projected_net > 0 ? "+" : ""}
                        {money(forecast.projected_net)}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`mt-3 text-[11px] py-1.5 px-3 rounded-lg text-center font-medium ${
                      forecast.projected_net >= 0
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {forecast.projected_net >= 0
                      ? "✅ Bon rythme ce mois-ci"
                      : `⚠️ Risque déficit dans ${forecast.remaining_days}j`}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl p-5 bg-indigo-900/20 border border-indigo-500/15 text-center text-xs text-white/30 flex items-center justify-center"
                style={{ minHeight: 160 }}
              >
                Prévision IA non disponible
              </div>
            )}

            {healthScore && (
              <div className="rounded-2xl p-5 bg-black/40 border border-white/[0.06]">
                <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                  Score de Santé · {healthScore.score}/100
                </div>
                <div className="space-y-2.5">
                  {[
                    {
                      label: "Épargne",
                      value: healthScore.breakdown.savings_rate,
                      color: "#22c55e",
                    },
                    {
                      label: "Budget",
                      value: healthScore.breakdown.budget_compliance,
                      color: "#60a5fa",
                    },
                    {
                      label: "Urgence",
                      value: healthScore.breakdown.emergency_fund,
                      color: "#eab308",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/50">{item.label}</span>
                        <span className="font-semibold">
                          {item.value.toFixed(0)}/25
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(item.value / 25) * 100}%`,
                            background: item.color,
                            boxShadow: `0 0 6px ${item.color}80`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {healthScore.insights.length > 0 && (
                  <div className="mt-3 text-[11px] text-white/40 italic border-t border-white/[0.06] pt-3 leading-relaxed">
                    {healthScore.insights[0]}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <FIProgressStrip savingsRatePct={savingsRatePct} monthlyNet={totals.net} />
      </section>

      {/* ══════════════════════════════════════ LAYER 3: ACTION CENTER */}
      <section className="animate-fade-in-up delay-300 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-orange-400 to-red-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">
            Couche 3 — Centre d&apos;Action
          </h2>
        </div>

        {/* Decision Engine */}
        {decisions.length > 0 && (
          <div className="rounded-3xl p-6 bg-black/30 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-orange-400"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold">
                  Moteur de Décision Financière
                </h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Actions recommandées basées sur votre situation
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decisions.map((d) => (
                <DecisionCard
                  key={d.id}
                  icon={d.icon}
                  title={d.title}
                  description={d.description}
                  impact={d.impact}
                  cta={d.cta}
                  href={d.href}
                  tone={d.tone}
                />
              ))}
            </div>
          </div>
        )}

        {/* Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <div className="rounded-2xl bg-black/30 border border-orange-500/15 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold">Alertes Budget</h3>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-bold">
                {budgetAlerts.length}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {budgetAlerts.map((a, i) => {
                const pct = Math.min(
                  (Math.abs(a.total) / (a.budget_limit || 1)) * 100,
                  100
                );
                const critical = pct >= 100;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      critical
                        ? "bg-red-500/[0.08] border-red-500/20"
                        : "bg-orange-500/[0.08] border-orange-500/20"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        {a.name}
                        {critical && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500 text-white uppercase">
                            !
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {money(Math.abs(a.total))} / {money(a.budget_limit || 0)}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        critical ? "text-red-400" : "text-orange-400"
                      }`}
                    >
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════ CATEGORIES & REPORT */}
      <section className="rounded-2xl bg-black/30 border border-white/[0.06] p-6 animate-fade-in-up delay-400 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">
              Budgets &amp; Catégories
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Répartition par catégorie sur la période
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="mb-badge">{byCategory.length}</span>
            <select
              className="mb-input text-xs py-1.5 px-2 h-auto"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | "income" | "expense")
              }
            >
              <option value="all">Tous</option>
              <option value="income">Revenus</option>
              <option value="expense">Dépenses</option>
            </select>
          </div>
        </div>

        {byCategory.length > 0 && (
          <div className="flex justify-center">
            <DonutChart
              data={byCategory.slice(0, 8).map((c, i) => {
                const palette = [
                  "#6366f1",
                  "#eab308",
                  "#ef4444",
                  "#06b6d4",
                  "#f97316",
                  "#8b5cf6",
                  "#10b981",
                  "#ec4899",
                ];
                return {
                  id: i,
                  label: c.name,
                  value: Math.abs(c.total),
                  color:
                    c.type === "income" ? "#22c55e" : palette[i % palette.length],
                };
              })}
              centerTextTop="Top 8"
              centerTextBottom={money(
                byCategory
                  .slice(0, 8)
                  .reduce((acc, c) => acc + Math.abs(c.total), 0)
              )}
            />
          </div>
        )}

        {weeklyReport && (
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.08] border border-violet-500/15 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-violet-500/15 text-violet-400">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="text-xs font-semibold text-white/70">
                Rapport Nexus — Semaine du {weeklyReport.week_start}
              </h3>
            </div>
            <p className="text-xs text-white/50 whitespace-pre-line leading-relaxed">
              {weeklyReport.content
                .replace(/#{1,3}\s*/g, "")
                .replace(/\*\*/g, "")}
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {byCategory.map((c, idx) => {
            const consumed = Math.abs(c.total);
            const limit = c.budget_limit || 0;
            const hasLimit = limit > 0 && c.type === "expense";
            const maxVal = Math.max(
              ...byCategory.map((x) => Math.abs(x.total)),
              1
            );
            const w = hasLimit
              ? Math.min((consumed / limit) * 100, 100)
              : (consumed / maxVal) * 100;
            const barColor =
              c.type === "income"
                ? "rgba(34,197,94,0.6)"
                : hasLimit && w >= 90
                  ? "rgba(239,68,68,0.7)"
                  : hasLimit && w >= 75
                    ? "rgba(234,179,8,0.7)"
                    : "rgba(34,197,94,0.7)";
            return (
              <div
                key={idx}
                className="rounded-xl p-4 bg-black/20 border border-white/[0.04] hover:border-white/10 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{c.name}</div>
                    <div className="text-xs text-white/40 mt-0.5 uppercase tracking-wider">
                      {c.type === "income" ? "Revenus" : "Dépenses"} ·{" "}
                      {num(c.count)} tx
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold">{money(consumed)}</div>
                    {hasLimit && (
                      <div className="text-xs text-white/30 mt-0.5">
                        / {money(limit)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${w}%`,
                      background: barColor,
                      boxShadow: `0 0 6px ${barColor}`,
                    }}
                  />
                </div>
                {hasLimit && (
                  <div className="mt-1 text-[11px] text-white/30 text-right">
                    {w.toFixed(0)}% utilisé
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════ SIMULATOR CTA */}
      <section
        className="rounded-3xl p-7 relative overflow-hidden border border-indigo-500/20 animate-fade-in-up delay-500"
        style={{
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(168,85,247,0.06) 100%)",
        }}
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔬</span>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/20">
                Simulateur de Vie
              </span>
            </div>
            <h3 className="text-xl font-bold">Testez votre avenir financier</h3>
            <p className="text-sm text-white/50 mt-1.5 max-w-md">
              Simulez l&apos;impact d&apos;investir plus, d&apos;acheter une
              maison ou d&apos;augmenter vos revenus sur votre patrimoine futur
              et votre âge de retraite.
            </p>
            {savingsRatePct > 0 &&
              (() => {
                const yfi = yearsToFI(savingsRatePct);
                return yfi !== null ? (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/30 border border-white/10 text-sm">
                    <span className="text-white/50">À votre taux actuel:</span>
                    <span className="font-bold text-indigo-300">
                      ~{Math.ceil(yfi)} ans jusqu&apos;à l&apos;IF
                    </span>
                  </div>
                ) : null;
              })()}
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <Link
              href="/planification/simulator"
              className="mb-btn mb-btn-primary gap-2 justify-center whitespace-nowrap"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              Lancer le Simulateur
            </Link>
            <Link
              href="/planification/goals"
              className="mb-btn gap-2 justify-center whitespace-nowrap text-sm"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 8 12 12 14 14" />
              </svg>
              Mes Objectifs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
