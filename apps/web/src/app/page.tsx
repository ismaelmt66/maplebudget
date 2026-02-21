"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Category,
  Transaction,
  Dashboard,
  getCategories,
  getTransactions,
  getDashboard,
  createCategory,
  createTransaction,
} from "@/lib/api";

const LOCALE = "fr-CA";
const CURRENCY = "CAD";

function money(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
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

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="text-xs border rounded-full px-3 py-1 opacity-80">{children}</span>;
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-xs border rounded-full px-3 py-1 ${ok ? "bg-black/5" : "bg-black/[0.02]"} opacity-80`}>
      {label}
    </span>
  );
}

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border rounded-3xl p-7">
      <div className="font-semibold text-lg">{title}</div>
      {desc && <div className="text-sm opacity-70 mt-2">{desc}</div>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function MiniKpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border rounded-2xl p-4">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs opacity-60 mt-2">{hint}</div>}
    </div>
  );
}

function SkeletonRow() {
  return <div className="h-12 rounded-2xl border bg-black/[0.03]" />;
}

function Sparkline({ values }: { values: number[] }) {
  // Simple SVG sparkline (net trend)
  if (values.length < 2) {
    return (
      <div className="border rounded-2xl p-4 text-sm opacity-70">
        Pas assez de données pour afficher une tendance.
      </div>
    );
  }

  const w = 240;
  const h = 60;
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (values.length - 1);
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return { x, y };
  });

  const d = `M ${pts.map((p, i) => `${i === 0 ? "" : "L "}${p.x} ${p.y}`).join(" ")}`;
  const area = `${d} L ${pts[pts.length - 1].x} ${h - pad} L ${pts[0].x} ${h - pad} Z`;

  return (
    <div className="border rounded-2xl p-4">
      <div className="text-xs opacity-70">Net trend (14 jours)</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[64px] mt-2">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.30)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#fill)" />
        <path d={d} fill="none" stroke="rgba(0,0,0,0.75)" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div className="text-xs opacity-60 mt-2">
        min {money(min)} • max {money(max)}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);

  async function load() {
    try {
      setErr(null);
      setLoading(true);

      // If API is down, any fetch fails -> we show offline UI
      const [d, c, t] = await Promise.all([getDashboard(), getCategories(), getTransactions()]);

      setApiOnline(true);
      setDashboard(d);
      setCats(c);
      setTxs(t);
    } catch (e: any) {
      setApiOnline(false);
      setErr(e?.message ?? "API unreachable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // derived: recent activity
  const recent = useMemo(() => (txs ?? []).slice(0, 6), [txs]);

  // derived: guided demo status
  const hasSomeCategories = cats.length >= 2;
  const hasSomeTx = txs.length >= 3;

  // derived: sparkline (net daily for last 14 days)
  const net14 = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 14 }, (_, i) => ymd(addDays(today, -(13 - i))));
    const map = new Map<string, { income: number; expense: number }>();
    for (const d of days) map.set(d, { income: 0, expense: 0 });

    for (const t of txs) {
      if (!map.has((t as any).date)) continue;
      const amount = Number((t as any).amount);
      const type = (t as any).category?.type ?? "expense";
      const cur = map.get((t as any).date)!;
      if (type === "income") cur.income += amount;
      else cur.expense += amount;
    }

    return days.map((d) => {
      const v = map.get(d)!;
      return v.income - v.expense;
    });
  }, [txs]);

  async function copyPitch() {
    const text =
      `MapleBudget — pitch (15s)\n` +
      `MVP full-stack (Next.js + FastAPI + SQLite) pour suivre revenus/dépenses, ` +
      `transformer des transactions en insights (KPIs, tendances, top catégories), ` +
      `avec API documentée (/docs) et UI produit.\n`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback: no-op
    }
  }

  async function createDemoData() {
    // Creates a clean demo dataset (idempotent-ish): if categories exist, we reuse them
    try {
      setErr(null);

      // refresh categories first (avoid duplicates)
      const currentCats = await getCategories();
      const findCat = (name: string, type: string) =>
        currentCats.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type);

      async function ensureCat(name: string, type: "income" | "expense") {
        const existing = findCat(name, type);
        if (existing) return existing.id;
        const created = await createCategory({ name, type });
        return created.id;
      }

      const today = new Date();
      const cSalary = await ensureCat("Salaire", "income");
      const cRent = await ensureCat("Loyer", "expense");
      const cGro = await ensureCat("Courses", "expense");
      const cTrans = await ensureCat("Transport", "expense");

      // Add a few transactions across the last 10 days for nicer charts
      const plan = [
        { dayOffset: -9, amount: 2300, cat: cSalary, note: "Paie" },
        { dayOffset: -8, amount: 900, cat: cRent, note: "Mensuel" },
        { dayOffset: -6, amount: 75, cat: cGro, note: "Supermarché" },
        { dayOffset: -4, amount: 55, cat: cTrans, note: "Bus" },
        { dayOffset: -2, amount: 48, cat: cGro, note: "Courses" },
      ];

      // Create transactions sequentially (safer for beginners)
      for (const x of plan) {
        await createTransaction({
          amount: x.amount,
          date: ymd(addDays(today, x.dayOffset)),
          note: x.note,
          category_id: x.cat,
        });
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur démo");
    }
  }

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="border rounded-3xl p-8 md:p-10 relative overflow-hidden">
        {/* subtle background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-black/5 blur-2xl" />
          <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-black/5 blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex flex-wrap gap-2">
            <Badge>Portfolio Project</Badge>
            <Badge>Full-Stack</Badge>
            <Badge>Next.js • FastAPI • SQLite</Badge>
            <Pill ok={apiOnline} label={apiOnline ? "API: Online" : "API: Offline"} />
          </div>

          <h1 className="text-3xl md:text-5xl font-semibold mt-5 leading-tight">
            MapleBudget — une home page vivante qui vend ton projet.
          </h1>

          <p className="text-sm md:text-base opacity-75 mt-4 max-w-3xl">
            Ce MVP transforme des transactions en <b>insights</b> (KPIs, tendances, catégories dominantes)
            avec une UI “produit” et une API documentée.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center border rounded-xl px-5 py-3 text-sm hover:bg-black/5 transition"
            >
              Ouvrir le Dashboard
            </Link>
            <Link
              href="/transactions"
              className="inline-flex items-center justify-center border rounded-xl px-5 py-3 text-sm hover:bg-black/5 transition"
            >
              Gérer les Transactions
            </Link>
            <button
              onClick={copyPitch}
              className="inline-flex items-center justify-center border rounded-xl px-5 py-3 text-sm hover:bg-black/5 transition"
              title="Copie un pitch prêt pour recruteur"
            >
              Copier le pitch
            </button>
          </div>

          <div className="mt-6 text-xs opacity-70">
            Tips : si tu vois “API: Offline”, démarre FastAPI puis clique “Rafraîchir” plus bas.
          </div>
        </div>
      </section>

      {/* Live stats + actions */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card
          title="Live overview"
          desc="Compteurs live + tendance. (Si l’API tourne, ça se met à jour.)"
        >
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : dashboard ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <MiniKpi label="Revenus" value={money(dashboard.income_total)} hint="selon tes données" />
                <MiniKpi label="Dépenses" value={money(dashboard.expense_total)} hint="selon tes données" />
                <MiniKpi label="Net" value={money(dashboard.net)} hint={dashboard.net >= 0 ? "positif" : "négatif"} />
                <MiniKpi label="Transactions" value={`${txs.length}`} hint="total enregistré" />
              </div>

              <div className="mt-5">
                <Sparkline values={net14} />
              </div>
            </>
          ) : (
            <div className="text-sm opacity-70">
              Aucune donnée chargée. Démarre l’API ou crée des données de démo.
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={load}
              className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            >
              Rafraîchir
            </button>
            <button
              onClick={createDemoData}
              className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
              title="Crée quelques catégories + transactions (démo) pour rendre le dashboard vivant"
            >
              Créer des données de démo
            </button>
            <a
              href="http://127.0.0.1:8000/docs"
              className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            >
              API /docs
            </a>
          </div>

          {err && (
            <div className="mt-4 border rounded-2xl p-4 text-sm">
              <b>Erreur:</b> {err}
              <div className="opacity-70 mt-2">
                Vérifie : <code>http://127.0.0.1:8000/health</code> et ouvre le web sur{" "}
                <code>http://localhost:3000</code>.
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Guided demo (pour recruteur)"
          desc="Une checklist claire pour faire une démo en 60 secondes."
        >
          <div className="grid gap-3">
            <div className="border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">1) Créer des catégories</div>
                <Pill ok={hasSomeCategories} label={hasSomeCategories ? "OK" : "À faire"} />
              </div>
              <div className="text-sm opacity-70 mt-2">
                Ajoute au moins 2 catégories (ex: Salaire, Loyer).
              </div>
            </div>

            <div className="border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">2) Ajouter des transactions</div>
                <Pill ok={hasSomeTx} label={hasSomeTx ? "OK" : "À faire"} />
              </div>
              <div className="text-sm opacity-70 mt-2">
                Ajoute au moins 3 transactions pour alimenter les graphiques.
              </div>
            </div>

            <div className="border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">3) Montrer le Dashboard</div>
                <Pill ok={!!dashboard} label={dashboard ? "OK" : "À faire"} />
              </div>
              <div className="text-sm opacity-70 mt-2">
                Ouvre <b>/dashboard</b> et explique KPIs + insights + visuels.
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/transactions" className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition">
              Aller aux transactions
            </Link>
            <Link href="/dashboard" className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition">
              Aller au dashboard
            </Link>
            <button
              onClick={createDemoData}
              className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            >
              Remplir la démo
            </button>
          </div>
        </Card>
      </section>

      {/* Activity feed */}
      <section className="border rounded-3xl p-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold">Activity feed</h2>
            <p className="text-sm opacity-70 mt-2">
              Les dernières actions (ça donne “vie” au produit).
            </p>
          </div>
          <Link href="/transactions" className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
            Tout voir
          </Link>
        </div>

        <div className="mt-6 space-y-2">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : recent.length === 0 ? (
            <div className="text-sm opacity-70">Aucune transaction pour le moment.</div>
          ) : (
            recent.map((t) => {
              const amount = Number((t as any).amount);
              const catName = (t as any).category?.name ?? "?";
              const catType = (t as any).category?.type ?? "expense";
              const note = (t as any).note ?? "";
              const date = (t as any).date ?? "";

              return (
                <div key={(t as any).id} className="border rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {catName}{" "}
                      <span className="text-xs opacity-60">
                        ({catType})
                      </span>
                    </div>
                    <div className="text-xs opacity-70 mt-1 truncate">
                      {date}{note ? ` • ${note}` : ""}
                    </div>
                  </div>
                  <div className="font-semibold">{money(amount)}</div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* What it demonstrates */}
      <section className="grid gap-6 md:grid-cols-3">
        <div className="border rounded-3xl p-7">
          <div className="font-semibold">Ce que ça démontre</div>
          <ul className="mt-4 space-y-2 text-sm opacity-80 list-disc pl-5">
            <li>Monorepo : <code>apps/web</code> + <code>apps/api</code></li>
            <li>API REST + docs : <code>/docs</code></li>
            <li>UI produit : dashboards, états, UX claire</li>
            <li>Analytics : KPIs, tendances, catégories dominantes</li>
          </ul>
        </div>

        <div className="border rounded-3xl p-7 md:col-span-2">
          <div className="font-semibold">Roadmap (ce qu’on peut ajouter ensuite)</div>
          <div className="text-sm opacity-70 mt-2">
            Pour passer de MVP → produit : Auth, objectifs, credit builder, Postgres, déploiement.
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
            <div className="border rounded-2xl p-5">
              <div className="font-medium">Auth + multi-utilisateurs</div>
              <div className="opacity-70 mt-2">Séparer les données par utilisateur (login/register).</div>
            </div>
            <div className="border rounded-2xl p-5">
              <div className="font-medium">Objectifs (voiture, épargne)</div>
              <div className="opacity-70 mt-2">Plan d’épargne mensuel + suivi.</div>
            </div>
            <div className="border rounded-2xl p-5">
              <div className="font-medium">Credit builder (éducatif)</div>
              <div className="opacity-70 mt-2">Checklist + score simulé transparent.</div>
            </div>
            <div className="border rounded-2xl p-5">
              <div className="font-medium">Déploiement</div>
              <div className="opacity-70 mt-2">Web Vercel, API Render/Fly, DB Postgres.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}