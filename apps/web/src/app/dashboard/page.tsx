"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getCategories, getTransactions, Category, Transaction } from "@/lib/api";

type Tx = Transaction & {
  amountNum: number;
  catName: string;
  catType: "income" | "expense";
};

type SeriesPoint = {
  key: string;     // YYYY-MM-DD
  label: string;   // display
  income: number;
  expense: number;
  net: number;
};

const LOCALE = "fr-CA";
const CURRENCY = "CAD";

function money(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}
function num(n: number) {
  return new Intl.NumberFormat(LOCALE).format(n);
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function parseYMD(ymd: string) {
  return new Date(`${ymd}T00:00:00`);
}
function dayLabel(d: Date) {
  return d.toLocaleDateString(LOCALE, { month: "short", day: "2-digit" });
}
function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

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
      ? { borderColor: "rgba(34,197,94,0.28)", background: "rgba(34,197,94,0.06)" }
      : tone === "bad"
      ? { borderColor: "rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.06)" }
      : tone === "warn"
      ? { borderColor: "rgba(234,179,8,0.28)", background: "rgba(234,179,8,0.06)" }
      : { borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)" };

  return (
    <div className="mb-card-soft p-5 mb-lift" style={toneStyle as any}>
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1 tracking-tight">{value}</div>
      {hint && <div className="text-xs opacity-60 mt-2">{hint}</div>}
    </div>
  );
}

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
    if (min === max) {
      min -= 1;
      max += 1;
    }

    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;

    const span = max - min || 1;
    const xStep = (W - PAD_L - PAD_R) / (values.length - 1);

    const pts = values.map((v, i) => {
      const x = PAD_L + i * xStep;
      const y = PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / span);
      return { x, y, v, i };
    });

    const line = `M ${pts.map((p, i) => `${i === 0 ? "" : "L "}${p.x} ${p.y}`).join(" ")}`;
    const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;

    const y0 =
      mode === "net"
        ? PAD_T + (H - PAD_T - PAD_B) * (1 - (0 - min) / span)
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
    const BAD  = { s: "rgba(239,68,68,0.90)", a1: "rgba(239,68,68,0.18)", a2: "rgba(239,68,68,0.02)" };
    const PRI  = { s: "rgba(96,165,250,0.90)", a1: "rgba(96,165,250,0.20)", a2: "rgba(96,165,250,0.02)" };

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

  if (!data) {
    return <div className="text-sm opacity-70">Pas assez de données pour afficher le graphique.</div>;
  }

  const hi = hoverIdx !== null ? data.pts[hoverIdx] : null;

  const statusLabel =
    summary.status === "healthy" ? "Sain" :
    summary.status === "watch" ? "Surveillance" :
    summary.status === "risk" ? "Risque" : "Aucune donnée";

  return (
    <div className="chart-shell p-4 md:p-5 relative" ref={wrapRef}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold">
            Trend {mode === "net" ? "Net" : mode === "income" ? "Revenus" : "Dépenses"}
          </div>
          <div className="text-xs opacity-70 mt-1">
            Signal: <span className="font-semibold">{statusLabel}</span>{" "}
            {summary.income > 0 && (
              <>• Dépenses/Revenus: <span className="font-semibold">{Math.round(summary.ratio * 100)}%</span></>
            )}
          </div>
        </div>
        <div className="text-xs opacity-70">Hover = valeurs</div>
      </div>

      <svg
        viewBox={`0 0 ${data.W} ${data.H}`}
        className="w-full h-[360px]"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <defs>
          <linearGradient id="fillArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={theme.a1} />
            <stop offset="100%" stopColor={theme.a2} />
          </linearGradient>

          <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={theme.s} stopOpacity="0.65" />
            <stop offset="55%" stopColor={theme.s} stopOpacity="0.95" />
            <stop offset="100%" stopColor={theme.s} stopOpacity="0.70" />
          </linearGradient>
        </defs>

        {/* Zones message (NET uniquement) */}
        {mode === "net" && data.y0 !== null && (
          <>
            <rect
              x={data.PAD_L}
              y={data.PAD_T}
              width={data.W - data.PAD_L - data.PAD_R}
              height={Math.max(0, data.y0 - data.PAD_T)}
              fill="rgba(34,197,94,0.06)"
            />
            <rect
              x={data.PAD_L}
              y={data.y0}
              width={data.W - data.PAD_L - data.PAD_R}
              height={Math.max(0, data.H - data.PAD_B - data.y0)}
              fill="rgba(239,68,68,0.05)"
            />
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
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2"
            />
            <text
              x={data.PAD_L - 10}
              y={t.y + 4}
              textAnchor="end"
              fontSize="12"
              fill="rgba(236,243,255,0.60)"
            >
              {money(t.v)}
            </text>
          </g>
        ))}

        {/* baseline */}
        <line
          x1={data.PAD_L}
          y1={data.H - data.PAD_B}
          x2={data.W - data.PAD_R}
          y2={data.H - data.PAD_B}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="2"
        />

        {/* area + line */}
        <path d={data.area} fill="url(#fillArea)" />
        <path d={data.line} fill="none" stroke="url(#lineGrad)" strokeWidth="3.5" strokeLinejoin="round" />

        {/* x labels (every 3 points) */}
        {series.map((p, i) => {
          if (i % 3 !== 0 && i !== series.length - 1) return null;
          const x = data.pts[i].x;
          return (
            <text
              key={p.key}
              x={x}
              y={data.H - 14}
              textAnchor="middle"
              fontSize="12"
              fill="rgba(236,243,255,0.55)"
            >
              {p.label}
            </text>
          );
        })}

        {/* hover crosshair + dot */}
        {hi && (
          <>
            <line
              x1={hi.x}
              y1={data.PAD_T}
              x2={hi.x}
              y2={data.H - data.PAD_B}
              stroke="rgba(255,255,255,0.20)"
              strokeWidth="2"
            />
            <circle cx={hi.x} cy={hi.y} r="6" fill="rgba(0,0,0,0.35)" />
            <circle cx={hi.x} cy={hi.y} r="4" fill={theme.s} />
          </>
        )}
      </svg>

      {/* Tooltip: seulement quand hoverIdx != null (donc disparaît à la sortie) */}
      {hoverIdx !== null && wrapRef.current && (
        <div
          className="mb-tooltip absolute"
          style={{
            width: 260,
            left: clamp(mx + 14, 12, wrapRef.current.clientWidth - 280),
            top: clamp(my - 10, 12, 300),
            pointerEvents: "none", // évite tout “flash”
          }}
        >
          <div className="text-xs opacity-70">Date</div>
          <div className="font-semibold">{series[hoverIdx].key}</div>
          <div className="text-xs opacity-70 mt-1">{series[hoverIdx].label}</div>

          <div className="mt-2 text-sm grid grid-cols-2 gap-1">
            <div className="opacity-70">Revenus</div>
            <div className="text-right">{money(series[hoverIdx].income)}</div>
            <div className="opacity-70">Dépenses</div>
            <div className="text-right">{money(series[hoverIdx].expense)}</div>
            <div className="opacity-70">Net</div>
            <div className="text-right font-semibold">{money(series[hoverIdx].net)}</div>
          </div>

          {summary.income > 0 && (
            <div className="mt-2 text-xs opacity-75">
              Épargne estimée: <span className="font-semibold">{summary.savingsRate.toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [txs, setTxs] = useState<Tx[]>([]);
  const [cats, setCats] = useState<Category[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [mode, setMode] = useState<"net" | "income" | "expense">("net");

  async function loadAll() {
    try {
      setErr(null);
      setLoading(true);

      const [c, t] = await Promise.all([getCategories(), getTransactions()]);
      setCats(c);

      const normalized: Tx[] = t.map((x) => {
        const amountNum = Number((x as any).amount);
        const cat = (x as any).category as Category | undefined;
        return {
          ...(x as any),
          amountNum: Number.isFinite(amountNum) ? amountNum : 0,
          catName: cat?.name ?? "?",
          catType: (cat?.type ?? "expense") as any,
        };
      });

      setTxs(normalized);

      // default last 30 days
      const today = new Date();
      const dTo = ymd(today);
      const dFrom = ymd(addDays(today, -29));
      setToDate((p) => p || dTo);
      setFromDate((p) => p || dFrom);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        setErr("Tu dois être connecté pour voir le dashboard.");
      } else {
        setErr(e?.message ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTxs = useMemo(() => {
    let out = [...txs];
    if (fromDate) out = out.filter((t) => t.date >= fromDate);
    if (toDate) out = out.filter((t) => t.date <= toDate);
    if (typeFilter !== "all") out = out.filter((t) => t.catType === typeFilter);
    out.sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
    return out;
  }, [txs, fromDate, toDate, typeFilter]);

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
    const map = new Map<string, { name: string; type: "income" | "expense"; total: number; count: number }>();
    for (const t of filteredTxs) {
      const k = `${t.catName}__${t.catType}`;
      const cur = map.get(k) ?? { name: t.catName, type: t.catType, total: 0, count: 0 };
      cur.total += t.amountNum;
      cur.count += 1;
      map.set(k, cur);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    return list;
  }, [filteredTxs]);

  const recent = useMemo(() => filteredTxs.slice(0, 8), [filteredTxs]);

  return (
    <main className="space-y-8">
      {/* header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="mb-badge">Dashboard</span>
            <span className="mb-badge">Signal: {signal.label}</span>
            <span className="mb-badge">Période: {fromDate && toDate ? `${fromDate} → ${toDate}` : "Toutes dates"}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-3">
            Vue rapide
          </h1>
          <p className="text-sm opacity-70 mt-2">
            KPIs, trend interactif (hover), catégories dominantes et dernières transactions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="mb-btn" onClick={loadAll} disabled={loading}>
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
          <Link className="mb-btn" href="/transactions">Gérer transactions</Link>
        </div>
      </section>

      {err && (
        <div className="mb-card-soft p-6" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)" }}>
          <div className="font-semibold">Erreur</div>
          <div className="text-sm opacity-80 mt-2">{err}</div>
          <div className="text-sm opacity-70 mt-4">
            <Link className="mb-btn mb-btn-primary" href="/login">Se connecter</Link>
          </div>
        </div>
      )}
      {/* ACTION RECOMMANDÉE (auto) */}
{(() => {
  const hasTx = totals.count > 0;
  const topExpense = byCategory.find((c) => c.type === "expense") ?? null;

  if (!hasTx) {
    return (
      <section className="mb-card-soft p-6 mb-lift">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm opacity-70">Action recommandée</div>
            <div className="text-xl font-semibold mt-1">Ajouter les premières transactions</div>
            <div className="text-sm opacity-70 mt-2 max-w-2xl">
              Ajoute 5 transactions sur 7 jours : le graphique devient fiable et le signal se stabilise.
            </div>
          </div>
          <span className="mb-badge">Onboarding</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="mb-btn mb-btn-primary" href="/transactions">Ajouter maintenant</Link>
          <Link className="mb-btn" href="/goals">Créer un objectif</Link>
        </div>
      </section>
    );
  }

  if (totals.net < 0) {
    return (
      <section className="mb-card-soft p-6 mb-lift">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm opacity-70">Action recommandée</div>
            <div className="text-xl font-semibold mt-1">Optimiser la dépense dominante</div>
            <div className="text-sm opacity-70 mt-2 max-w-2xl">
              Ton net est négatif sur la période. Commence par la catégorie la plus lourde
              {topExpense ? (
                <>
                  {" "}
                  : <span className="font-semibold">{topExpense.name}</span> ({money(topExpense.total)}).
                </>
              ) : (
                "."
              )}{" "}
              C’est le levier le plus efficace.
            </div>
          </div>
          <span className="mb-badge">Signal: Déficit</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="mb-btn mb-btn-primary" href="/transactions">Examiner / ajuster</Link>
          <button className="mb-btn" onClick={loadAll} disabled={loading}>
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-card-soft p-6 mb-lift">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm opacity-70">Action recommandée</div>
          <div className="text-xl font-semibold mt-1">Transformer l’excédent en objectif</div>
          <div className="text-sm opacity-70 mt-2 max-w-2xl">
            Ton net est positif sur la période. Fixe un objectif et fais un premier dépôt pour rendre la progression concrète.
          </div>
        </div>
        <span className="mb-badge">Signal: Excédent</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="mb-btn mb-btn-primary" href="/goals">Créer / gérer un objectif</Link>
        <Link className="mb-btn" href="/transactions">Continuer à tracker</Link>
      </div>
    </section>
  );
})()}

{/* ACTIONS + OUTILS (séparés) */}
<section className="grid gap-4 lg:grid-cols-12">
  {/* ACTIONS */}
  <div className="lg:col-span-7 mb-card-soft p-6">
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div className="text-base font-semibold">Actions rapides</div>
        <div className="text-sm opacity-70 mt-1">Les actions “produit” (ce que l’utilisateur veut faire).</div>
      </div>
      <span className="mb-badge">Actions</span>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <div className="mb-card-soft p-5 mb-lift">
        <div className="text-sm opacity-70">Action</div>
        <div className="text-base font-semibold mt-1">Ajouter transaction</div>
        <div className="text-sm opacity-70 mt-2">
          Alimente les insights du dashboard.
        </div>
        <div className="mt-4">
          <Link className="mb-btn mb-btn-primary" href="/transactions">Ouvrir</Link>
        </div>
      </div>

      <div className="mb-card-soft p-5 mb-lift">
        <div className="text-sm opacity-70">Action</div>
        <div className="text-base font-semibold mt-1">Gérer objectifs</div>
        <div className="text-sm opacity-70 mt-2">
          Plan mensuel + dépôts + progression.
        </div>
        <div className="mt-4">
          <Link className="mb-btn mb-btn-primary" href="/goals">Ouvrir</Link>
        </div>
      </div>

      <div className="mb-card-soft p-5 mb-lift">
        <div className="text-sm opacity-70">Action</div>
        <div className="text-base font-semibold mt-1">Voir transactions</div>
        <div className="text-sm opacity-70 mt-2">
          Filtrer / ajuster rapidement.
        </div>
        <div className="mt-4">
          <Link className="mb-btn" href="/transactions">Aller</Link>
        </div>
      </div>
    </div>
  </div>

  {/* OUTILS */}
  <div className="lg:col-span-5 mb-card-soft p-6">
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div className="text-base font-semibold">Outils</div>
        <div className="text-sm opacity-70 mt-1">Raccourcis & opérations (sans quitter le dashboard).</div>
      </div>
      <span className="mb-badge">Outils</span>
    </div>

    {/* Raccourcis période */}
    <div className="mt-4">
      <div className="text-sm font-semibold">Période</div>
      <div className="text-sm opacity-70 mt-1">Change uniquement les dates (rapide et stable).</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="mb-btn mb-btn-primary"
          onClick={() => {
            const to = new Date();
            const from = new Date(Date.now() - (30 - 1) * 86400000);
            setToDate(to.toISOString().slice(0, 10));
            setFromDate(from.toISOString().slice(0, 10));
          }}
        >
          30D
        </button>

        <button
          className="mb-btn"
          onClick={() => {
            const to = new Date();
            const from = new Date(Date.now() - (60 - 1) * 86400000);
            setToDate(to.toISOString().slice(0, 10));
            setFromDate(from.toISOString().slice(0, 10));
          }}
        >
          60D
        </button>

        <button
          className="mb-btn"
          onClick={() => {
            const to = new Date();
            const from = new Date(Date.now() - (90 - 1) * 86400000);
            setToDate(to.toISOString().slice(0, 10));
            setFromDate(from.toISOString().slice(0, 10));
          }}
        >
          90D
        </button>

        <button
          className="mb-btn"
          onClick={() => {
            setFromDate("");
            setToDate("");
          }}
        >
          Tout
        </button>
      </div>
    </div>

    {/* Ops */}
    <div className="mt-5 grid gap-2">
      <button className="mb-btn mb-btn-primary" onClick={loadAll} disabled={loading}>
        {loading ? "Chargement…" : "Rafraîchir les données"}
      </button>

      <button
        className="mb-btn"
        onClick={() => {
          setFromDate("");
          setToDate("");
          setTypeFilter("all");
          setMode("net");
        }}
      >
        Reset filtres (dates + type + focus)
      </button>
    </div>

    <div className="mt-4 text-xs opacity-60">
      Astuce : utilise 30D/60D/90D, puis survole le graphe pour lire la tendance.
    </div>
  </div>
</section>
      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-4">
        <KPI label="Revenus" value={money(totals.income)} hint="selon filtres" tone="good" />
        <KPI label="Dépenses" value={money(totals.expense)} hint="selon filtres" tone="warn" />
        <KPI label="Net" value={money(totals.net)} hint={`Signal: ${signal.label}`} tone={signal.tone} />
        <KPI label="Transactions" value={num(totals.count)} hint="dans la période" tone="neutral" />
      </section>

      {/* Controls + chart */}
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 mb-card-soft p-6">
          <div className="text-base font-semibold">Filtres</div>
          <div className="text-sm opacity-70 mt-1">Affiner la lecture sans bruit.</div>

          <div className="mt-4 grid gap-3">
            <label className="text-sm">
              De
              <input className="mb-input mt-1" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="text-sm">
              À
              <input className="mb-input mt-1" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>

            <label className="text-sm">
              Type
              <select className="mb-input mt-1" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                <option value="all">Tous</option>
                <option value="income">Revenus</option>
                <option value="expense">Dépenses</option>
              </select>
            </label>

            <label className="text-sm">
              Graph focus
              <select className="mb-input mt-1" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="net">Net</option>
                <option value="income">Revenus</option>
                <option value="expense">Dépenses</option>
              </select>
            </label>

            <button
              className="mb-btn"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setTypeFilter("all");
                setMode("net");
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="lg:col-span-8">
          <TrendChart series={series} mode={mode} />
        </div>
      </section>

      {/* categories + recent */}
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6 mb-card-soft p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Totaux par catégorie</div>
              <div className="text-sm opacity-70 mt-1">Top 8 (après filtres)</div>
            </div>
            <span className="mb-badge">{byCategory.length} catégorie(s)</span>
          </div>

          <div className="mt-4 space-y-3">
            {byCategory.slice(0, 8).map((c, idx) => {
              const max = Math.max(...byCategory.map((x) => Math.abs(x.total)), 1);
              const w = (Math.abs(c.total) / max) * 100;
              const grad =
                c.type === "income"
                  ? "linear-gradient(90deg, rgba(34,197,94,0.35), rgba(96,165,250,0.18))"
                  : "linear-gradient(90deg, rgba(234,179,8,0.35), rgba(239,68,68,0.16))";

              return (
                <div key={idx} className="mb-card-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {c.type === "income" ? "Revenus" : "Dépenses"} • {num(c.count)} tx
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{money(c.total)}</div>
                      <div className="text-xs opacity-60">total</div>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div style={{ width: `${clamp(w, 0, 100)}%`, height: "100%", background: grad }} />
                  </div>
                </div>
              );
            })}
            {!byCategory.length && <div className="text-sm opacity-70">Aucune donnée.</div>}
          </div>
        </div>

        <div className="lg:col-span-6 mb-card-soft p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Dernières transactions</div>
              <div className="text-sm opacity-70 mt-1">Aperçu “produit”</div>
            </div>
            <Link className="mb-btn mb-btn-ghost" href="/transactions">Voir tout</Link>
          </div>

          <div className="mt-4 space-y-2">
            {recent.map((t) => (
              <div key={t.id} className="mb-card-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.catName}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {t.date}{t.note ? ` • ${t.note}` : ""}
                    </div>
                  </div>
                  <div
                    className="font-semibold"
                    style={{
                      color: t.catType === "income" ? "rgb(var(--mb-good))" : "rgb(var(--mb-warn))",
                    }}
                  >
                    {money(t.amountNum)}
                  </div>
                </div>
              </div>
            ))}
            {!recent.length && <div className="text-sm opacity-70">Aucune transaction.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}