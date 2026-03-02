"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, getTransactions, me, Transaction } from "@/lib/api";

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

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-card-soft p-6 mb-lift">
      <div className="text-base font-semibold">{title}</div>
      <div className="text-sm opacity-70 mt-2">{desc}</div>
    </div>
  );
}

/* ===========================
   Finance Stream (premium)
   =========================== */

const FINANCE_STREAM = [
  { kind: "rule", title: "Paye-toi d’abord", text: "Automatise une épargne le jour de paie." },
  { kind: "tip", title: "3 postes à surveiller", text: "Logement, transport, nourriture : c’est là que ça bouge le plus." },
  { kind: "didyouknow", title: "Budget = liberté", text: "Un budget n’est pas une restriction, c’est un plan." },
  { kind: "reminder", title: "Fuites invisibles", text: "Les petites dépenses répétées pèsent souvent plus qu’un gros achat." },
  { kind: "tip", title: "Net négatif", text: "Ajuste d’abord le variable avant de toucher au nécessaire." },
  { kind: "story", title: "Rythme > magie", text: "Les vrais progrès viennent d’habitudes simples et régulières." },
  { kind: "focus", title: "Coussin d’urgence", text: "1 mois, puis 3 mois, puis 6 mois de dépenses." },
  { kind: "rule", title: "Crédit (idéal)", text: "Garder l’utilisation sous 30% aide la stabilité." },
] as const;

type StreamKind = (typeof FINANCE_STREAM)[number]["kind"];

function StreamIcon({ kind }: { kind: StreamKind }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none" as const };
  const stroke = "rgba(236,243,255,0.80)";

  if (kind === "rule")
    return (
      <svg {...common}>
        <path d="M7 6h10M7 12h10M7 18h6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

  if (kind === "tip")
    return (
      <svg {...common}>
        <path
          d="M12 3a7 7 0 0 0-4 12v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a7 7 0 0 0-4-12Z"
          stroke={stroke}
          strokeWidth="2"
        />
        <path d="M9 21h6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

  if (kind === "didyouknow")
    return (
      <svg {...common}>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" stroke={stroke} strokeWidth="2" />
        <path d="M12 10v6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M12 7h.01" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );

  if (kind === "reminder")
    return (
      <svg {...common}>
        <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Z" stroke={stroke} strokeWidth="2" />
        <path
          d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z"
          stroke={stroke}
          strokeWidth="2"
        />
      </svg>
    );

  if (kind === "story")
    return (
      <svg {...common}>
        <path d="M4 6h16v12H4z" stroke={stroke} strokeWidth="2" />
        <path d="M8 10h8M8 14h6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

  // focus
  return (
    <svg {...common}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4Z" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

function StreamChip({ kind, title, text }: { kind: StreamKind; title: string; text: string }) {
  const palette: Record<StreamKind, { bg: string; bd: string }> = {
    rule: { bg: "rgba(99,102,241,0.14)", bd: "rgba(99,102,241,0.22)" },
    tip: { bg: "rgba(96,165,250,0.14)", bd: "rgba(96,165,250,0.22)" },
    didyouknow: { bg: "rgba(34,197,94,0.12)", bd: "rgba(34,197,94,0.20)" },
    reminder: { bg: "rgba(234,179,8,0.12)", bd: "rgba(234,179,8,0.20)" },
    story: { bg: "rgba(255,255,255,0.10)", bd: "rgba(255,255,255,0.16)" },
    focus: { bg: "rgba(96,165,250,0.10)", bd: "rgba(96,165,250,0.18)" },
  };

  const tag = {
    rule: "Règle",
    tip: "Astuce",
    didyouknow: "Le saviez-vous",
    reminder: "Rappel",
    story: "Histoire",
    focus: "Focus",
  }[kind];

  return (
    <div
      className="mb-marquee-item"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        borderColor: palette[kind].bd,
        background: palette[kind].bg,
      }}
    >
      <span
        className="mb-badge"
        style={{
          borderColor: palette[kind].bd,
          background: "rgba(0,0,0,0.18)",
          padding: "6px 10px",
        }}
      >
        <StreamIcon kind={kind} />
        {tag}
      </span>

      <span style={{ opacity: 0.95 }}>
        <span style={{ fontWeight: 600 }}>{title} :</span>{" "}
        <span style={{ opacity: 0.85 }}>{text}</span>
      </span>
    </div>
  );
}

/* ===========================
   Page
   =========================== */

export default function HomePage() {
  const [authed, setAuthed] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);

  // Load preview data (if logged in)
  useEffect(() => {
    (async () => {
      try {
        setPreviewErr(null);
        setLoadingPreview(true);

        await me(); // if 401 -> not logged
        setAuthed(true);

        const t = await getTransactions();
        setTxs(t);
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 401) {
          setAuthed(false);
          setTxs([]);
        } else {
          setPreviewErr(e?.message ?? "Erreur");
        }
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, []);

  const preview = useMemo(() => {
    // Preview = last 30 days totals
    const today = new Date();
    const from = ymd(addDays(today, -29));
    const to = ymd(today);

    let income = 0;
    let expense = 0;

    for (const t of txs) {
      const date = (t as any).date as string;
      if (date < from || date > to) continue;

      const amount = Number((t as any).amount);
      const type = (t as any).category?.type ?? "expense";
      if (type === "income") income += amount;
      else expense += amount;
    }

    const net = income - expense;
    return { income, expense, net, from, to };
  }, [txs]);

  return (
    <main className="space-y-10">
      {/* HERO */}
      <section className="mb-card p-7 md:p-10 relative overflow-hidden">
        <div className="flex flex-wrap gap-2">
          <span className="mb-badge">Portfolio FinTech</span>
          <span className="mb-badge">Stable UI</span>
          <span className="mb-badge">Analytics</span>
          <span className="mb-badge">Multi-utilisateurs</span>
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7 space-y-4">
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
              Multipliez vos opportunités.
            </h1>

            <p className="text-sm md:text-base opacity-70 max-w-xl">
              MapleBudget — un pilotage financier clair : dashboard premium, transactions propres,
              objectifs et analytics. Conçu pour une démo recruteur.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link className="mb-btn mb-btn-primary" href="/dashboard">
                Ouvrir le Dashboard
              </Link>
              <Link className="mb-btn" href="/transactions">
                Transactions
              </Link>
              <Link className="mb-btn" href="/login">
                Se connecter
              </Link>
            </div>

            <div className="text-xs opacity-60">
              Stack : Next.js • FastAPI • SQLite (dev) • Postgres (déploiement)
            </div>
          </div>

          {/* Right product preview */}
          <div className="md:col-span-5">
            <div className="mb-card-soft p-6 mb-lift">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Aperçu produit</div>
                <span className="mb-badge">{authed ? "Live (30j)" : "Démo"}</span>
              </div>

              <div className="mt-4 text-xs opacity-60">
                {authed ? `Période: ${preview.from} → ${preview.to}` : "Connecte-toi pour voir tes données."}
              </div>

              {previewErr && (
                <div className="mt-3 text-sm opacity-80">
                  Erreur aperçu: {previewErr}
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="mb-card-soft p-4">
                  <div className="text-xs opacity-70">Revenus</div>
                  <div className="text-lg font-semibold mt-1" style={{ color: "rgb(var(--mb-good))" }}>
                    {loadingPreview ? "…" : authed ? money(preview.income) : "—"}
                  </div>
                </div>
                <div className="mb-card-soft p-4">
                  <div className="text-xs opacity-70">Dépenses</div>
                  <div className="text-lg font-semibold mt-1" style={{ color: "rgb(var(--mb-warn))" }}>
                    {loadingPreview ? "…" : authed ? money(preview.expense) : "—"}
                  </div>
                </div>
                <div className="mb-card-soft p-4">
                  <div className="text-xs opacity-70">Net</div>
                  <div
                    className="text-lg font-semibold mt-1"
                    style={{
                      color:
                        !authed
                          ? "rgba(236,243,255,0.70)"
                          : preview.net > 0
                          ? "rgb(var(--mb-good))"
                          : preview.net < 0
                          ? "rgb(var(--mb-bad))"
                          : "rgb(var(--mb-primary))",
                    }}
                  >
                    {loadingPreview ? "…" : authed ? money(preview.net) : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm opacity-70">
                Dashboard premium + graphique interactif + catégories dominantes.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINANCE STREAM (premium chips + icons) */}
      <section className="mb-card-soft p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-base font-semibold">Finance Stream</div>
            <div className="text-sm opacity-70 mt-1">
              Conseils courts, propres et utiles. Survole pour pause.
            </div>
          </div>
          <span className="mb-badge">Conseils • Règles • Faits</span>
        </div>

        <div className="mt-4 mb-marquee">
          <div className="mb-marquee-track">
            {[...FINANCE_STREAM, ...FINANCE_STREAM].map((x, idx) => (
              <StreamChip key={idx} kind={x.kind} title={x.title} text={x.text} />
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card title="Dashboard premium" desc="KPIs clairs, trend interactif (hover), catégories dominantes, insights." />
        <Card title="Transactions propres" desc="Ajout rapide, historique lisible, filtres/tri, UX stable." />
        <Card title="Objectifs" desc="Plan mensuel, dépôts, suivi de progression — logique “banque”." />
      </section>

      {/* Démarrage rapide */}
      <section className="mb-card p-7 md:p-10 mb-lift">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-2xl font-semibold">Démarrage rapide</div>
            <div className="text-sm opacity-70 mt-2 max-w-2xl">
              Un espace clair pour avancer sans se perdre : configure, enregistre, puis analyse.
            </div>
          </div>
          <span className="mb-badge">Prochaines actions</span>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-12">
          {/* Steps */}
          <div className="lg:col-span-8 grid gap-4 md:grid-cols-3">
            <div className="mb-card-soft p-6 mb-lift">
              <div className="text-sm opacity-70">Étape 1</div>
              <div className="text-base font-semibold mt-1">Créer des catégories</div>
              <div className="text-sm opacity-70 mt-2">
                Exemple : Salaire, Loyer, Courses, Transport, Abonnements.
              </div>
              <div className="mt-4">
                <Link className="mb-btn mb-btn-primary" href="/transactions">
                  Ouvrir Transactions
                </Link>
              </div>
            </div>

            <div className="mb-card-soft p-6 mb-lift">
              <div className="text-sm opacity-70">Étape 2</div>
              <div className="text-base font-semibold mt-1">Ajouter des transactions</div>
              <div className="text-sm opacity-70 mt-2">
                5–10 lignes suffisent pour voir une tendance fiable.
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Link className="mb-btn mb-btn-primary" href="/transactions">
                  Ajouter
                </Link>
                <Link className="mb-btn" href="/dashboard">
                  Voir l’impact
                </Link>
              </div>
            </div>

            <div className="mb-card-soft p-6 mb-lift">
              <div className="text-sm opacity-70">Étape 3</div>
              <div className="text-base font-semibold mt-1">Fixer un objectif</div>
              <div className="text-sm opacity-70 mt-2">
                Plan mensuel automatique + dépôts : simple et motivant.
              </div>
              <div className="mt-4">
                <Link className="mb-btn mb-btn-primary" href="/goals">
                  Ouvrir Goals
                </Link>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="lg:col-span-4">
            <div className="mb-card-soft p-6 mb-lift">
              <div className="text-base font-semibold">Checklist</div>
              <div className="text-sm opacity-70 mt-2">
                Une mini routine qui donne des résultats vite.
              </div>

              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex gap-2">
                  <span className="opacity-80">✓</span>
                  <span className="opacity-80">Ajouter 4 catégories (2 revenus + 2 dépenses)</span>
                </li>
                <li className="flex gap-2">
                  <span className="opacity-80">✓</span>
                  <span className="opacity-80">Entrer 5 transactions sur 7 jours</span>
                </li>
                <li className="flex gap-2">
                  <span className="opacity-80">✓</span>
                  <span className="opacity-80">Vérifier le signal et les catégories dominantes</span>
                </li>
                <li className="flex gap-2">
                  <span className="opacity-80">✓</span>
                  <span className="opacity-80">Créer un objectif + déposer une fois</span>
                </li>
              </ul>

              <div className="mt-5 text-xs opacity-60">
                Note : en dev, les données sont locales (SQLite). En déploiement : Postgres.
              </div>

              <div className="mt-5 flex gap-2 flex-wrap">
                <Link className="mb-btn" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="mb-btn" href="/transactions">
                  Transactions
                </Link>
                <Link className="mb-btn" href="/goals">
                  Goals
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}