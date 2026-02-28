"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCategories, getTransactions, Category, Transaction } from "@/lib/api";

/**
 * MapleBudget — Pro Dashboard (no external chart lib)
 * Features:
 * - Date range filter + quick presets
 * - Category search + type filter + sorting + hide zero
 * - Net trend area chart (SVG)
 * - Donut chart for category share (SVG)
 * - Insights cards (top categories, biggest tx, avg/day, projection)
 * - Recent transactions preview
 * - Export CSV (client-side)
 * - Copy “Executive summary” to clipboard
 */

type Tx = Transaction & { amountNum: number; catName: string; catType: string };

type SeriesPoint = {
  key: string; // day/week/month key
  label: string;
  income: number;
  expense: number;
  net: number;
};

type CatAgg = {
  category_id: number;
  name: string;
  type: "income" | "expense";
  total: number;
  count: number;
};

const LOCALE = "fr-CA";
const CURRENCY = "CAD";

function money(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}
function num(n: number) {
  return new Intl.NumberFormat(LOCALE).format(n);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function parseYMD(ymd: string) {
  // Force local midnight (avoid timezone shifting)
  return new Date(`${ymd}T00:00:00`);
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
function startOfWeek(d: Date) {
  // Monday as start (fr-CA style)
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  return x;
}
function monthLabel(d: Date) {
  return d.toLocaleDateString(LOCALE, { year: "numeric", month: "short" });
}
function weekLabel(d: Date) {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  const sLab = s.toLocaleDateString(LOCALE, { month: "short", day: "2-digit" });
  const eLab = e.toLocaleDateString(LOCALE, { month: "short", day: "2-digit" });
  return `${sLab} → ${eLab}`;
}
function dayLabel(d: Date) {
  return d.toLocaleDateString(LOCALE, { month: "short", day: "2-digit" });
}

function hashColor(input: string) {
  // stable, classy-ish palette without external libs
  const palette = [
    "bg-black/70",
    "bg-black/55",
    "bg-black/40",
    "bg-black/25",
    "bg-black/15",
  ];
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function donutPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  // angles in radians
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function toCSV(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function KPI({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border rounded-2xl p-5">
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs opacity-60 mt-2">{hint}</div>}
    </div>
  );
}

function Skeleton() {
  return <div className="h-12 rounded-2xl border bg-black/[0.03]" />;
}

export default function DashboardPage() {
  // ---- UI state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ---- raw data
  const [cats, setCats] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  // ---- filters
  const [fromDate, setFromDate] = useState<string>(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>(""); // YYYY-MM-DD
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState<string>("");
  const [hideZero, setHideZero] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<"total_desc" | "total_asc" | "count_desc" | "name_asc">("total_desc");

  // ---- “analytics modes”
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [focus, setFocus] = useState<"net" | "expense" | "income">("net");

  // ---- fetch
  async function loadAll() {
    try {
      setErr(null);
      setLoading(true);
      const [c, t] = await Promise.all([getCategories(), getTransactions()]);
      const catMap = new Map<number, Category>();
      c.forEach((x) => catMap.set(x.id, x));

      const normalized: Tx[] = t.map((x) => {
        const cat = (x as any).category ?? catMap.get((x as any).category_id) ?? null;
        const amountNum = Number((x as any).amount);
        return {
          ...(x as any),
          amountNum: Number.isFinite(amountNum) ? amountNum : 0,
          catName: cat?.name ?? "?",
          catType: (cat?.type ?? "expense") as any,
        };
      });

      setCats(c);
      setTxs(normalized);

      // Auto date defaults: last 30 days based on today
      const today = new Date();
      const dTo = ymd(today);
      const dFrom = ymd(addDays(today, -29));

      setToDate((prev) => prev || dTo);
      setFromDate((prev) => prev || dFrom);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- filter txs by date range
  const filteredTxs = useMemo(() => {
    let out = [...txs];

    if (fromDate) out = out.filter((t) => t.date >= fromDate);
    if (toDate) out = out.filter((t) => t.date <= toDate);

    if (typeFilter !== "all") out = out.filter((t) => t.catType === typeFilter);

    return out;
  }, [txs, fromDate, toDate, typeFilter]);

  // ---- KPI totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filteredTxs) {
      if (t.catType === "income") income += t.amountNum;
      else expense += t.amountNum;
    }
    const net = income - expense;

    // active days count
    const daySet = new Set(filteredTxs.map((t) => t.date));
    const activeDays = daySet.size;

    const avgTx = filteredTxs.length ? (income + expense) / filteredTxs.length : 0;

    return { income, expense, net, activeDays, avgTx, count: filteredTxs.length };
  }, [filteredTxs]);

  // ---- category aggregates
  const byCategory = useMemo(() => {
    const map = new Map<number, CatAgg>();

    for (const t of filteredTxs) {
      // in our current API response, transaction has full category object => category id exists in category
      const catId = (t.category?.id ?? (t as any).category_id ?? 0) as number;
      const name = t.catName ?? t.category?.name ?? "?";
      const type = (t.catType ?? t.category?.type ?? "expense") as any;

      const cur = map.get(catId) ?? { category_id: catId, name, type, total: 0, count: 0 };
      cur.total += t.amountNum;
      cur.count += 1;
      map.set(catId, cur);
    }

    let list = Array.from(map.values());

    // search
    const s = search.trim().toLowerCase();
    if (s) list = list.filter((c) => c.name.toLowerCase().includes(s));

    // hide zero
    if (hideZero) list = list.filter((c) => Math.abs(c.total) > 0.000001);

    // sort
    list = [...list];
    if (sortBy === "total_desc") list.sort((a, b) => b.total - a.total);
    if (sortBy === "total_asc") list.sort((a, b) => a.total - b.total);
    if (sortBy === "count_desc") list.sort((a, b) => b.count - a.count);
    if (sortBy === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [filteredTxs, search, hideZero, sortBy]);

  // ---- time series
  const series = useMemo((): SeriesPoint[] => {
    const m = new Map<string, SeriesPoint>();

    for (const t of filteredTxs) {
      const d = parseYMD(t.date);

      let key: string;
      let label: string;

      if (groupBy === "day") {
        key = t.date;
        label = dayLabel(d);
      } else if (groupBy === "week") {
        const s = startOfWeek(d);
        key = ymd(s);
        label = weekLabel(s);
      } else {
        const s = startOfMonth(d);
        key = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
        label = monthLabel(s);
      }

      const cur = m.get(key) ?? { key, label, income: 0, expense: 0, net: 0 };
      if (t.catType === "income") cur.income += t.amountNum;
      else cur.expense += t.amountNum;
      cur.net = cur.income - cur.expense;
      m.set(key, cur);
    }

    const list = Array.from(m.values());
    // sort by key (works: YYYY-MM-DD or YYYY-MM)
    list.sort((a, b) => a.key.localeCompare(b.key));
    return list;
  }, [filteredTxs, groupBy]);

  // ---- insights
  const insights = useMemo(() => {
    const topExpense = byCategory.filter((c) => c.type === "expense")[0] ?? null;
    const topIncome = byCategory.filter((c) => c.type === "income")[0] ?? null;

    let biggest: Tx | null = null;
    for (const t of filteredTxs) {
      if (!biggest || t.amountNum > biggest.amountNum) biggest = t;
    }

    // projection: based on average daily net over the selected period
    let projection: { projectedNet: number; days: number } | null = null;
    if (fromDate && toDate) {
      const a = parseYMD(fromDate);
      const b = parseYMD(toDate);
      const days = Math.max(1, Math.round((+b - +a) / (1000 * 60 * 60 * 24)) + 1);
      const avgDailyNet = totals.net / days;
      projection = { projectedNet: avgDailyNet * days, days };
    }

    return { topExpense, topIncome, biggest, projection };
  }, [byCategory, filteredTxs, fromDate, toDate, totals.net]);

  // ---- executive summary
  const executiveSummary = useMemo(() => {
    const period = fromDate || toDate ? `Période: ${fromDate || "…"} → ${toDate || "…"}\n` : "Période: toutes dates\n";
    const lines = [
      "MapleBudget — Executive Summary",
      period.trim(),
      `Revenus: ${money(totals.income)}`,
      `Dépenses: ${money(totals.expense)}`,
      `Net: ${money(totals.net)}`,
      `Transactions: ${num(totals.count)} • Jours actifs: ${num(totals.activeDays)}`,
      insights.topExpense ? `Top dépense: ${insights.topExpense.name} (${money(insights.topExpense.total)})` : "Top dépense: —",
      insights.topIncome ? `Top revenu: ${insights.topIncome.name} (${money(insights.topIncome.total)})` : "Top revenu: —",
    ];
    return lines.join("\n");
  }, [fromDate, toDate, totals, insights]);

  // ---- chart geometry (SVG area)
  const areaChart = useMemo(() => {
    const points = series.map((p) => {
      if (focus === "income") return p.income;
      if (focus === "expense") return p.expense;
      return p.net;
    });

    if (points.length < 2) return null;

    const W = 900;
    const H = 220;
    const PAD = 18;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;

    const xStep = (W - PAD * 2) / (points.length - 1);

    const coords = points.map((v, i) => {
      const x = PAD + i * xStep;
      const y = PAD + (H - PAD * 2) * (1 - (v - min) / span);
      return { x, y, v, i };
    });

    const line = `M ${coords.map((c, i) => `${i === 0 ? "" : "L "}${c.x} ${c.y}`).join(" ")}`;
    const area = `${line} L ${coords[coords.length - 1].x} ${H - PAD} L ${coords[0].x} ${H - PAD} Z`;

    // last point label
    const last = coords[coords.length - 1];
    const first = coords[0];

    return { W, H, PAD, min, max, coords, line, area, first, last };
  }, [series, focus]);

  // ---- donut data (category share) based on chosen focus type
  const donut = useMemo(() => {
    const relevant = byCategory
      .filter((c) => {
        if (focus === "income") return c.type === "income";
        if (focus === "expense") return c.type === "expense";
        // for net, we show expense share (most useful)
        return c.type === "expense";
      })
      .slice(0, 6); // top 6

    const total = relevant.reduce((s, c) => s + Math.abs(c.total), 0);
    if (!total) return null;

    const cx = 120;
    const cy = 120;
    const r = 78;

    let a = -Math.PI / 2; // start at top
    const segs = relevant.map((c) => {
      const frac = Math.abs(c.total) / total;
      const b = a + frac * Math.PI * 2;
      const path = donutPath(cx, cy, r, a, b);
      const mid = (a + b) / 2;
      a = b;
      return { ...c, frac, path, mid };
    });

    return { segs, total, cx, cy, r };
  }, [byCategory, focus]);

  // ---- helpers for presets
  function preset(days: number) {
    const today = new Date();
    setToDate(ymd(today));
    setFromDate(ymd(addDays(today, -(days - 1))));
  }

  function exportCSV() {
    const rows = filteredTxs.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amountNum,
      category: t.catName,
      type: t.catType,
      note: t.note ?? "",
    }));
    const csv = toCSV(rows);
    downloadTextFile(`maplebudget-transactions-${fromDate || "all"}-${toDate || "all"}.csv`, csv || "id,date,amount,category,type,note\n");
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(executiveSummary);
    } catch {
      // fallback
      downloadTextFile("maplebudget-summary.txt", executiveSummary);
    }
  }

  const periodLabel = useMemo(() => {
    if (!fromDate && !toDate) return "Toutes dates";
    if (fromDate && !toDate) return `Depuis ${fromDate}`;
    if (!fromDate && toDate) return `Jusqu’au ${toDate}`;
    return `${fromDate} → ${toDate}`;
  }, [fromDate, toDate]);

  const recentTxs = useMemo(() => filteredTxs.slice(0, 8), [filteredTxs]);

  return (
    <main className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs border rounded-full px-3 py-1 opacity-70">
            <span>Analytics</span>
            <span className="opacity-40">•</span>
            <span>{periodLabel}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-3">Dashboard</h1>
          <p className="text-sm opacity-70 mt-1">
            Insights + visualisations (sans librairies) — orienté “produit”.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadAll}
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            disabled={loading}
            title="Recharger toutes les données"
          >
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>

          <button
            onClick={copySummary}
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            title="Copier un résumé exécutif (ou télécharger en fallback)"
          >
            Copier résumé
          </button>

          <button
            onClick={exportCSV}
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            title="Exporter les transactions filtrées en CSV"
          >
            Export CSV
          </button>

          <Link
            href="/transactions"
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
          >
            Transactions
          </Link>
        </div>
      </section>

      {/* Errors */}
      {err && (
        <div className="border rounded-2xl p-4 text-sm">
          <b>Erreur:</b> {err}
          <div className="opacity-70 mt-2">
            Vérifie que l’API tourne sur <code>127.0.0.1:8000</code> et que tu utilises{" "}
            <code>localhost:3000</code>.
          </div>
        </div>
      )}

      {/* Filters */}
      <section className="border rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold">Filtres</div>
            <div className="text-sm opacity-70 mt-1">Affiner l’analyse (dates, type, recherche, regroupement).</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => preset(7)} className="text-xs border rounded-full px-3 py-1 hover:bg-black/5 transition">7j</button>
            <button onClick={() => preset(30)} className="text-xs border rounded-full px-3 py-1 hover:bg-black/5 transition">30j</button>
            <button onClick={() => preset(90)} className="text-xs border rounded-full px-3 py-1 hover:bg-black/5 transition">90j</button>
            <button
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="text-xs border rounded-full px-3 py-1 hover:bg-black/5 transition"
              title="Supprimer les filtres de dates"
            >
              Reset dates
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <label className="text-sm">
            De
            <input
              type="date"
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>

          <label className="text-sm">
            À
            <input
              type="date"
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          <label className="text-sm">
            Type
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">Tous</option>
              <option value="income">Revenus</option>
              <option value="expense">Dépenses</option>
            </select>
          </label>

          <label className="text-sm">
            Grouping
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
            </select>
          </label>

          <label className="text-sm">
            Focus
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={focus}
              onChange={(e) => setFocus(e.target.value as any)}
            >
              <option value="net">Net</option>
              <option value="expense">Dépenses</option>
              <option value="income">Revenus</option>
            </select>
          </label>

          <label className="text-sm">
            Recherche catégorie
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="ex: Loyer, Courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                />
                <span>Masquer zéros</span>
              </label>

              <label className="text-sm inline-flex items-center gap-2">
                <span className="opacity-70">Tri:</span>
                <select
                  className="border rounded-xl px-3 py-2 text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="total_desc">Total (desc)</option>
                  <option value="total_asc">Total (asc)</option>
                  <option value="count_desc">Fréquence (desc)</option>
                  <option value="name_asc">Nom (A→Z)</option>
                </select>
              </label>
            </div>

            <div className="text-sm opacity-70">
              {num(filteredTxs.length)} transaction(s) • {num(totals.activeDays)} jour(s) actif(s)
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-4">
        {loading ? (
          <>
            <Skeleton /><Skeleton /><Skeleton /><Skeleton />
          </>
        ) : (
          <>
            <KPI label="Revenus" value={money(totals.income)} hint={periodLabel} />
            <KPI label="Dépenses" value={money(totals.expense)} hint={periodLabel} />
            <KPI label="Net" value={money(totals.net)} hint={totals.net >= 0 ? "Solde positif" : "Solde négatif"} />
            <KPI label="Moyenne / transaction" value={money(totals.avgTx)} hint={`Sur ${num(totals.count)} transaction(s)`} />
          </>
        )}
      </section>

      {/* Insights row */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-3xl p-6">
          <div className="font-semibold">Insights</div>
          <div className="text-sm opacity-70 mt-1">Résumé automatique (utile en démo).</div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="border rounded-2xl p-4">
              <div className="opacity-70 text-xs">Top dépense</div>
              <div className="font-medium mt-1">
                {insights.topExpense ? insights.topExpense.name : "—"}
              </div>
              <div className="opacity-70 mt-1">
                {insights.topExpense ? money(insights.topExpense.total) : ""}
              </div>
            </div>

            <div className="border rounded-2xl p-4">
              <div className="opacity-70 text-xs">Top revenu</div>
              <div className="font-medium mt-1">
                {insights.topIncome ? insights.topIncome.name : "—"}
              </div>
              <div className="opacity-70 mt-1">
                {insights.topIncome ? money(insights.topIncome.total) : ""}
              </div>
            </div>

            <div className="border rounded-2xl p-4">
              <div className="opacity-70 text-xs">Plus grosse transaction</div>
              <div className="font-medium mt-1">
                {insights.biggest ? `${insights.biggest.catName} • ${money(insights.biggest.amountNum)}` : "—"}
              </div>
              <div className="opacity-70 mt-1">
                {insights.biggest ? `${insights.biggest.date}${insights.biggest.note ? ` • ${insights.biggest.note}` : ""}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Trend */}
        <div className="border rounded-3xl p-6 md:col-span-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-semibold">Trend</div>
              <div className="text-sm opacity-70 mt-1">
                {focus === "net" ? "Net" : focus === "income" ? "Revenus" : "Dépenses"} • regroupé par{" "}
                {groupBy === "day" ? "jour" : groupBy === "week" ? "semaine" : "mois"}
              </div>
            </div>
            <div className="text-xs opacity-70">
              {series.length ? `${series.length} point(s)` : "Pas de données"}
            </div>
          </div>

          <div className="mt-5">
            {!areaChart ? (
              <div className="text-sm opacity-70">Pas assez de données pour afficher un graphique.</div>
            ) : (
              <div className="border rounded-2xl p-4">
                <svg viewBox={`0 0 ${areaChart.W} ${areaChart.H}`} className="w-full h-[220px]">
                  <defs>
                    <linearGradient id="gFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
                    </linearGradient>
                  </defs>

                  {/* baseline */}
                  <line
                    x1={areaChart.PAD}
                    y1={areaChart.H - areaChart.PAD}
                    x2={areaChart.W - areaChart.PAD}
                    y2={areaChart.H - areaChart.PAD}
                    stroke="rgba(0,0,0,0.12)"
                    strokeWidth="2"
                  />

                  {/* area */}
                  <path d={areaChart.area} fill="url(#gFill)" />

                  {/* line */}
                  <path d={areaChart.line} fill="none" stroke="rgba(0,0,0,0.70)" strokeWidth="4" strokeLinejoin="round" />

                  {/* points (subtle) */}
                  {areaChart.coords.map((c) => (
                    <circle key={c.i} cx={c.x} cy={c.y} r="4" fill="rgba(0,0,0,0.25)" />
                  ))}

                  {/* last marker */}
                  <circle cx={areaChart.last.x} cy={areaChart.last.y} r="7" fill="rgba(0,0,0,0.80)" />
                </svg>

                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <div className="opacity-70">
                    Début: <b>{series[0]?.label ?? "—"}</b>
                  </div>
                  <div className="opacity-70">
                    Fin: <b>{series[series.length - 1]?.label ?? "—"}</b>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* projection */}
          <div className="mt-4 border rounded-2xl p-4 text-sm">
            <div className="font-medium">Projection (simple)</div>
            <div className="opacity-70 mt-1">
              Basée sur le net moyen / jour sur la période sélectionnée.
            </div>
            {insights.projection ? (
              <div className="mt-2">
                <span className="opacity-70">Sur </span>
                <b>{num(insights.projection.days)}</b>
                <span className="opacity-70"> jours, net actuel ≈ </span>
                <b>{money(totals.net)}</b>
                <span className="opacity-70"> → net projeté (même cadence) ≈ </span>
                <b>{money(insights.projection.projectedNet)}</b>
              </div>
            ) : (
              <div className="mt-2 opacity-70">Sélectionne des dates pour activer la projection.</div>
            )}
          </div>
        </div>
      </section>

      {/* Category share + list */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-3xl p-6">
          <div className="font-semibold">Share (Top catégories)</div>
          <div className="text-sm opacity-70 mt-1">
            Donut basé sur {focus === "income" ? "revenus" : "dépenses"} (Top 6).
          </div>

          <div className="mt-5 flex items-center justify-center">
            {!donut ? (
              <div className="text-sm opacity-70">Aucune donnée.</div>
            ) : (
              <svg width="260" height="260" viewBox="0 0 240 240" className="block">
                {/* background ring */}
                <circle cx={donut.cx} cy={donut.cy} r={donut.r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="18" />
                {/* segments */}
                {donut.segs.map((s) => (
                  <path
                    key={s.category_id}
                    d={s.path}
                    fill="none"
                    stroke="rgba(0,0,0,0.75)"
                    strokeWidth="18"
                    strokeLinecap="butt"
                    opacity={0.15 + s.frac * 0.85}
                  />
                ))}
                {/* hole */}
                <circle cx={donut.cx} cy={donut.cy} r={donut.r - 18} fill="white" />
                {/* center text */}
                <text x={donut.cx} y={donut.cy - 6} textAnchor="middle" fontSize="12" fill="rgba(0,0,0,0.55)">
                  Total
                </text>
                <text x={donut.cx} y={donut.cy + 18} textAnchor="middle" fontSize="16" fontWeight="700" fill="rgba(0,0,0,0.90)">
                  {money(donut.total)}
                </text>
              </svg>
            )}
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {(donut?.segs ?? []).map((s) => (
              <div key={s.category_id} className="border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs opacity-70 mt-1">{(s.frac * 100).toFixed(1)}%</div>
                </div>
                <div className="font-semibold">{money(Math.abs(s.total))}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-3xl p-6 md:col-span-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-semibold">Catégories</div>
              <div className="text-sm opacity-70 mt-1">
                Totaux + fréquence. Recherche + tri + hide zero.
              </div>
            </div>
            <div className="text-xs opacity-70">{num(byCategory.length)} catégorie(s)</div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <>
                <Skeleton /><Skeleton /><Skeleton />
              </>
            ) : byCategory.length === 0 ? (
              <div className="text-sm opacity-70">Aucune catégorie (sur la période / filtres).</div>
            ) : (
              byCategory.slice(0, 10).map((c) => {
                const max = byCategory.length ? Math.max(...byCategory.map((x) => x.total)) : 1;
                const w = max ? (Math.abs(c.total) / Math.abs(max)) * 100 : 0;

                return (
                  <div key={c.category_id} className="border rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {c.name} <span className="text-xs opacity-60">({c.type})</span>
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {num(c.count)} transaction(s)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{money(c.total)}</div>
                        <div className="text-xs opacity-60">total</div>
                      </div>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-black/10 overflow-hidden">
                      <div className={`h-full ${hashColor(c.name)}`} style={{ width: `${clamp(w, 0, 100)}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {byCategory.length > 10 && (
            <div className="mt-4 text-sm opacity-70">
              Affichage Top 10. (Tu peux enlever le <code>slice(0, 10)</code> si tu veux tout voir.)
            </div>
          )}
        </div>
      </section>

      {/* Recent transactions */}
      <section className="border rounded-3xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold">Dernières transactions</div>
            <div className="text-sm opacity-70 mt-1">Un aperçu rapide pour la démo.</div>
          </div>
          <Link href="/transactions" className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
            Voir tout
          </Link>
        </div>

        <div className="mt-5 space-y-2">
          {loading ? (
            <>
              <Skeleton /><Skeleton /><Skeleton />
            </>
          ) : recentTxs.length === 0 ? (
            <div className="text-sm opacity-70">Aucune transaction.</div>
          ) : (
            recentTxs.map((t) => (
              <div key={t.id} className="border rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {t.catName} <span className="text-xs opacity-60">({t.catType})</span>
                  </div>
                  <div className="text-xs opacity-70 mt-1 truncate">
                    {t.date}{t.note ? ` • ${t.note}` : ""}
                  </div>
                </div>
                <div className="font-semibold">{money(t.amountNum)}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Dev helpers */}
      <section className="border rounded-3xl p-6">
        <div className="font-semibold">Dev / Démo</div>
        <div className="text-sm opacity-70 mt-1">
          Tips rapides pour la démonstration (recruteur).
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
          <div className="border rounded-2xl p-4">
            <div className="font-medium">Pitch 15 secondes</div>
            <div className="opacity-70 mt-2">
              “MapleBudget est un MVP full-stack (Next.js + FastAPI + DB) pour suivre dépenses/revenus,
              visualiser tendances et insights. Objectif : UX claire + architecture propre.”
            </div>
          </div>

          <div className="border rounded-2xl p-4">
            <div className="font-medium">Ce qui impressionne</div>
            <ul className="opacity-70 mt-2 list-disc pl-5 space-y-1">
              <li>Monorepo structuré</li>
              <li>API docs (/docs)</li>
              <li>Analytics + UI produit</li>
              <li>Workflow Git + commits</li>
            </ul>
          </div>

          <div className="border rounded-2xl p-4">
            <div className="font-medium">Actions rapides</div>
            <div className="opacity-70 mt-2 space-y-2">
              <button onClick={() => preset(30)} className="border rounded-xl px-3 py-2 text-sm hover:bg-black/5 transition w-full">
                Preset 30 jours
              </button>
              <button onClick={() => { setGroupBy("week"); setFocus("net"); }} className="border rounded-xl px-3 py-2 text-sm hover:bg-black/5 transition w-full">
                Mode “Net / semaine”
              </button>
              <button onClick={copySummary} className="border rounded-xl px-3 py-2 text-sm hover:bg-black/5 transition w-full">
                Copier résumé
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}