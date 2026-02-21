import Link from "next/link";

function Card({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block border rounded-2xl p-5 hover:bg-black/5 hover:border-black/10 transition"
    >
      <div className="font-semibold">{title}</div>
      <div className="text-sm opacity-70 mt-1">{desc}</div>
      <div className="text-sm mt-4 underline underline-offset-4">{cta}</div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="border rounded-3xl p-8 md:p-10">
        <div className="inline-flex items-center gap-2 text-xs border rounded-full px-3 py-1 opacity-70">
          <span>Portfolio Project</span>
          <span className="opacity-50">•</span>
          <span>Educational</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold mt-4 leading-tight">
          MapleBudget — budget simple, clair, et utile au quotidien.
        </h1>

        <p className="text-sm md:text-base opacity-70 mt-4 max-w-3xl">
          Une application éducative pensée pour les étudiants et nouveaux arrivants : suivre ses
          dépenses, structurer son budget, et visualiser ses tendances. 
          Objectif : montrer une
          approche full-stack propre (Next.js + FastAPI + DB).
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
          >
            Voir le Dashboard
          </Link>
          <Link
            href="/transactions"
            className="inline-flex items-center justify-center border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
          >
            Gérer les Transactions
          </Link>
        </div>
      </section>

      {/* STACK + FEATURES */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="border rounded-2xl p-6">
          <h2 className="font-semibold">Ce que ce projet démontre</h2>
          <ul className="mt-4 space-y-2 text-sm opacity-80 list-disc pl-5">
            <li>Architecture monorepo : <code>apps/web</code> + <code>apps/api</code></li>
            <li>API REST FastAPI avec documentation auto via <code>/docs</code></li>
            <li>Persistance de données via SQLite (migration vers Postgres possible)</li>
            <li>Intégration front-back : fetch côté client, CORS, endpoints dédiés</li>
            <li>Workflow Git propre : commits, branches, merges, repo structuré</li>
          </ul>
        </div>

        <div className="border rounded-2xl p-6">
          <h2 className="font-semibold">Fonctionnalités MVP</h2>
          <ul className="mt-4 space-y-2 text-sm opacity-80 list-disc pl-5">
            <li>Création / listing de catégories (income/expense)</li>
            <li>Création / listing de transactions</li>
            <li>Dashboard : revenus, dépenses, net, totaux par catégorie</li>
            <li>UI simple, lisible, et responsive</li>
          </ul>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card
          title="Dashboard"
          desc="Vue rapide: revenus, dépenses, net, catégories dominantes."
          href="/dashboard"
          cta="Ouvrir le dashboard"
        />
        <Card
          title="Transactions"
          desc="Ajouter et consulter tes transactions, liées à des catégories."
          href="/transactions"
          cta="Ouvrir les transactions"
        />
        <Card
          title="API Docs"
          desc="Documentation interactive FastAPI (Swagger) pour tester les endpoints."
          href="http://127.0.0.1:8000/docs"
          cta="Ouvrir /docs"
        />
      </section>

      {/* NEXT STEPS */}
      <section className="border rounded-2xl p-6">
        <h2 className="font-semibold">Prochaines étapes (roadmap)</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm opacity-80">
          <div className="border rounded-xl p-4">
            <div className="font-medium">Auth + multi-utilisateurs</div>
            <div className="opacity-80 mt-1">
              Séparer les données par utilisateur (inscription/connexion).
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="font-medium">Objectifs (voiture, épargne)</div>
            <div className="opacity-80 mt-1">
              Planifier un objectif et proposer une épargne mensuelle.
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="font-medium">Credit Builder (éducatif)</div>
            <div className="opacity-80 mt-1">
              Checklist + score simulé transparent (pas un vrai score bureau).
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="font-medium">Déploiement</div>
            <div className="opacity-80 mt-1">
              Web sur Vercel, API sur Render/Fly, DB Postgres.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}