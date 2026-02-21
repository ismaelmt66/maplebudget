import Link from "next/link";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs border rounded-full px-3 py-1 opacity-80">
      {children}
    </span>
  );
}

function Feature({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="border rounded-2xl p-5 hover:bg-black/5 transition">
      <div className="font-semibold">{title}</div>
      <div className="text-sm opacity-70 mt-2">{desc}</div>
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

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="border rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl border flex items-center justify-center font-semibold">
          {n}
        </div>
        <div className="font-semibold">{title}</div>
      </div>
      <div className="text-sm opacity-70 mt-2">{desc}</div>
    </div>
  );
}

export default function HomePage() {
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
            <Badge>Educational</Badge>
            <Badge>Next.js • FastAPI • SQLite</Badge>
          </div>

          <h1 className="text-3xl md:text-5xl font-semibold mt-5 leading-tight">
            MapleBudget — une app simple et moderne pour comprendre ton budget.
          </h1>

          <p className="text-sm md:text-base opacity-75 mt-4 max-w-3xl">
            Un MVP orienté “produit” conçu pour les étudiants et nouveaux arrivants : suivre ses
            revenus/dépenses, analyser les catégories dominantes et obtenir des insights.  
            Objectif : démontrer une architecture propre, une API claire, et une UI pro.
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
          </div>

          <div className="mt-8 text-xs opacity-70">
            Pitch (15s) : “MapleBudget est un MVP full-stack qui transforme des transactions en insights
            actionnables, avec une UI produit et une API documentée.”
          </div>
        </div>
      </section>

      {/* LIVE PREVIEW */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="border rounded-3xl p-7">
          <div className="font-semibold text-lg">Aperçu produit</div>
          <div className="text-sm opacity-70 mt-2">
            Voilà le type de rendu qu’un recruteur attend : KPIs, lisibilité, structure claire.
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MiniKpi label="Revenus (exemple)" value="$2,350.00" hint="Période: 30 jours" />
            <MiniKpi label="Dépenses (exemple)" value="$1,420.00" hint="Top: Loyer, Courses" />
            <MiniKpi label="Net (exemple)" value="$930.00" hint="Solde positif" />
            <MiniKpi label="Transactions (exemple)" value="42" hint="Jours actifs: 18" />
          </div>

          <div className="mt-6 flex gap-2 flex-wrap">
            <Badge>Filtres dates</Badge>
            <Badge>Export CSV</Badge>
            <Badge>Insights</Badge>
            <Badge>Visuels SVG</Badge>
          </div>
        </div>

        <div className="border rounded-3xl p-7">
          <div className="font-semibold text-lg">Architecture</div>
          <div className="text-sm opacity-70 mt-2">
            Monorepo clair et pro. Front et back séparés, mais versionnés ensemble.
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="border rounded-2xl p-4">
              <div className="font-medium">apps/web</div>
              <div className="opacity-70 mt-1">Next.js (App Router) • UI • pages /dashboard & /transactions</div>
            </div>

            <div className="border rounded-2xl p-4">
              <div className="font-medium">apps/api</div>
              <div className="opacity-70 mt-1">FastAPI • endpoints • docs auto (/docs) • SQLite</div>
            </div>

            <div className="border rounded-2xl p-4">
              <div className="font-medium">Qualité</div>
              <div className="opacity-70 mt-1">Commits propres • structure lisible • évolutif (Postgres + Auth)</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">Fonctionnalités MVP</h2>
            <p className="text-sm opacity-70 mt-2">
              Une base solide, simple à démo, mais avec des éléments “pro”.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
              Voir dashboard
            </Link>
            <Link href="/transactions" className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
              Voir transactions
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Feature
            title="Transactions & catégories"
            desc="Créer / lire / filtrer tes transactions et les classer (income/expense)."
          />
          <Feature
            title="Dashboard analytics"
            desc="KPIs, breakdown catégories, trends, insights, export CSV, résumé copiable."
          />
          <Feature
            title="API documentée"
            desc="FastAPI expose /docs (Swagger) pour tester les endpoints facilement."
          />
          <Feature
            title="UX produit"
            desc="UI claire, responsive, états loading/erreur, structure cohérente."
          />
          <Feature
            title="Architecture monorepo"
            desc="apps/web + apps/api dans un seul repo, workflow Git propre."
          />
          <Feature
            title="Évolutif"
            desc="Roadmap prête : Auth multi-utilisateurs, Postgres, objectifs (voiture), credit builder."
          />
        </div>
      </section>

      {/* HOW TO RUN */}
      <section className="border rounded-3xl p-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">Lancer le projet (local)</h2>
            <p className="text-sm opacity-70 mt-2">
              Simple à tester en 2 terminaux.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Step
            n="1"
            title="API (FastAPI)"
            desc="Active le venv, initialise la DB SQLite, puis lance uvicorn sur :8000."
          />
          <Step
            n="2"
            title="Web (Next.js)"
            desc="Dans apps/web, lance npm run dev sur :3000."
          />
          <Step
            n="3"
            title="Démo"
            desc="Ajoute des transactions, puis consulte /dashboard pour voir les insights."
          />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 text-sm">
          <div className="border rounded-2xl p-5">
            <div className="font-medium">API</div>
            <pre className="mt-2 text-xs opacity-80 whitespace-pre-wrap">
{`cd apps/api
source .venv/Scripts/activate
python init_db.py
python -m uvicorn main:app --reload --port 8000`}
            </pre>
          </div>

          <div className="border rounded-2xl p-5">
            <div className="font-medium">Web</div>
            <pre className="mt-2 text-xs opacity-80 whitespace-pre-wrap">
{`cd apps/web
npm run dev`}
            </pre>
          </div>
        </div>

        <div className="mt-6 text-sm opacity-70">
          Liens utiles :{" "}
          <a className="underline underline-offset-4" href="http://127.0.0.1:8000/docs">
            API /docs
          </a>{" "}
          •{" "}
          <Link className="underline underline-offset-4" href="/dashboard">
            Dashboard
          </Link>{" "}
          •{" "}
          <Link className="underline underline-offset-4" href="/transactions">
            Transactions
          </Link>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="border rounded-3xl p-8">
        <h2 className="text-xl font-semibold">Roadmap (prochaines features)</h2>
        <p className="text-sm opacity-70 mt-2">
          La suite logique pour passer d’un MVP à un produit.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="border rounded-2xl p-6">
            <div className="font-semibold">Auth + multi-utilisateurs</div>
            <div className="text-sm opacity-70 mt-2">
              Séparer les données par utilisateur (inscription/connexion) et sécuriser l’accès.
            </div>
          </div>
          <div className="border rounded-2xl p-6">
            <div className="font-semibold">Objectifs (ex: voiture)</div>
            <div className="text-sm opacity-70 mt-2">
              Planifier un objectif et calculer automatiquement une épargne mensuelle.
            </div>
          </div>
          <div className="border rounded-2xl p-6">
            <div className="font-semibold">Credit builder (éducatif)</div>
            <div className="text-sm opacity-70 mt-2">
              Checklist + score simulé transparent + conseils actionnables (sans promettre un vrai score).
            </div>
          </div>
          <div className="border rounded-2xl p-6">
            <div className="font-semibold">Déploiement</div>
            <div className="text-sm opacity-70 mt-2">
              Web sur Vercel • API sur Render/Fly • DB Postgres.
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border rounded-3xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="font-semibold text-lg">Prêt pour la démo</div>
            <div className="text-sm opacity-70 mt-2">
              Ajoute quelques transactions, puis montre le dashboard : ça fait “produit”.
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/transactions" className="border rounded-xl px-5 py-3 text-sm hover:bg-black/5 transition">
              Ajouter des transactions
            </Link>
            <Link href="/dashboard" className="border rounded-xl px-5 py-3 text-sm hover:bg-black/5 transition">
              Voir les insights
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}