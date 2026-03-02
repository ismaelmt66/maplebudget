"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, createGoal, deleteGoal, getGoalPlan, getGoals, updateGoal, Goal, GoalPlan } from "@/lib/api";

const LOCALE = "fr-CA";
const CURRENCY = "CAD";

function money(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}
function pct(cur: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (cur / target) * 100));
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Record<number, GoalPlan>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // create form
  const [title, setTitle] = useState("Voiture");
  const [targetAmount, setTargetAmount] = useState(8000);
  const [currentAmount, setCurrentAmount] = useState(500);
  const [targetDate, setTargetDate] = useState("2026-12-01");

  // deposit per goal
  const [depositByGoal, setDepositByGoal] = useState<Record<number, number>>({});

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const g = await getGoals();
      setGoals(g);

      const pairs = await Promise.all(
        g.map(async (x) => {
          try {
            const p = await getGoalPlan(x.id);
            return [x.id, p] as const;
          } catch {
            return [x.id, null] as const;
          }
        })
      );

      const next: Record<number, GoalPlan> = {};
      for (const [id, p] of pairs) if (p) next[id] = p;
      setPlans(next);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        setErr("Tu dois être connecté pour gérer les objectifs.");
      } else {
        setErr(e?.message ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const target = goals.reduce((s, g) => s + Number(g.target_amount), 0);
    const cur = goals.reduce((s, g) => s + Number(g.current_amount), 0);
    return { target, cur, p: pct(cur, target) };
  }, [goals]);

  async function onCreate() {
    try {
      setErr(null);
      await createGoal({
        title: title.trim(),
        target_amount: Number(targetAmount),
        current_amount: Number(currentAmount),
        target_date: targetDate,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  async function onDeposit(g: Goal) {
    const dep = Number(depositByGoal[g.id] ?? 0);
    if (!dep || dep <= 0) return;

    try {
      setErr(null);
      await updateGoal(g.id, { current_amount: Number(g.current_amount) + dep });
      setDepositByGoal((m) => ({ ...m, [g.id]: 0 }));
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  async function onDelete(goalId: number) {
    if (!confirm("Supprimer cet objectif ?")) return;
    try {
      setErr(null);
      await deleteGoal(goalId);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  return (
    <main className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="mb-badge">Goals</span>
            <span className="mb-badge">{goals.length} objectif(s)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-3">Objectifs</h1>
          <p className="text-sm opacity-70 mt-2">Plan mensuel + dépôts + progression.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link className="mb-btn" href="/dashboard">Dashboard</Link>
          <Link className="mb-btn" href="/transactions">Transactions</Link>
          <button className="mb-btn" onClick={load} disabled={loading}>
            {loading ? "…" : "Rafraîchir"}
          </button>
        </div>
      </section>

      {err && (
        <div className="mb-card-soft p-6" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)" }}>
          <div className="font-semibold">Erreur</div>
          <div className="text-sm opacity-80 mt-2">{err}</div>
          <div className="mt-4">
            <Link className="mb-btn mb-btn-primary" href="/login">Se connecter</Link>
          </div>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="mb-card-soft p-5 mb-lift">
          <div className="text-sm opacity-70">Total objectifs</div>
          <div className="text-2xl font-semibold mt-1">{money(totals.target)}</div>
        </div>
        <div className="mb-card-soft p-5 mb-lift">
          <div className="text-sm opacity-70">Déjà épargné</div>
          <div className="text-2xl font-semibold mt-1">{money(totals.cur)}</div>
        </div>
        <div className="mb-card-soft p-5 mb-lift">
          <div className="text-sm opacity-70">Progression globale</div>
          <div className="text-2xl font-semibold mt-1">{totals.p.toFixed(1)}%</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        {/* Create */}
        <div className="lg:col-span-4 mb-card-soft p-6">
          <div className="text-base font-semibold">Créer un objectif</div>
          <div className="text-sm opacity-70 mt-1">Voiture, épargne de sécurité, frais de scolarité…</div>

          <div className="mt-4 grid gap-3">
            <label className="text-sm">
              Titre
              <input className="mb-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="text-sm">
              Montant cible
              <input className="mb-input mt-1" type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} />
            </label>
            <label className="text-sm">
              Déjà épargné
              <input className="mb-input mt-1" type="number" value={currentAmount} onChange={(e) => setCurrentAmount(Number(e.target.value))} />
            </label>
            <label className="text-sm">
              Date cible
              <input className="mb-input mt-1" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>

            <button className="mb-btn mb-btn-primary" onClick={onCreate}>Créer</button>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-8 mb-card-soft p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Mes objectifs</div>
              <div className="text-sm opacity-70 mt-1">Plan mensuel calculé automatiquement.</div>
            </div>
            <span className="mb-badge">Top: Voiture / Épargne</span>
          </div>

          <div className="mt-4 space-y-4">
            {goals.map((g) => {
              const p = plans[g.id];
              const prog = pct(Number(g.current_amount), Number(g.target_amount));
              const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));

              return (
                <div key={g.id} className="mb-card-soft p-5 mb-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">{g.title}</div>
                      <div className="text-sm opacity-70 mt-1">
                        Cible: {money(Number(g.target_amount))} • Épargné: {money(Number(g.current_amount))} • Reste: {money(remaining)}
                      </div>
                      <div className="text-xs opacity-60 mt-1">Date cible: {g.target_date}</div>
                    </div>
                    <button className="mb-btn" onClick={() => onDelete(g.id)}>Supprimer</button>
                  </div>

                  <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${prog}%`,
                        background: "linear-gradient(90deg, rgba(96,165,250,0.55), rgba(34,197,94,0.25))",
                      }}
                    />
                  </div>
                  <div className="text-xs opacity-60 mt-2">{prog.toFixed(1)}% complété</div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="mb-card-soft p-4">
                      <div className="text-xs opacity-70">Mois restants</div>
                      <div className="text-lg font-semibold mt-1">{p ? p.months_remaining : "—"}</div>
                    </div>
                    <div className="mb-card-soft p-4">
                      <div className="text-xs opacity-70">Mensuel requis</div>
                      <div className="text-lg font-semibold mt-1">{p ? money(p.monthly_required) : "—"}</div>
                    </div>
                    <div className="mb-card-soft p-4">
                      <div className="text-xs opacity-70">Dépôt</div>
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          className="mb-input"
                          style={{ width: "100%" }}
                          placeholder="ex: 50"
                          value={depositByGoal[g.id] ?? 0}
                          onChange={(e) => setDepositByGoal((m) => ({ ...m, [g.id]: Number(e.target.value) }))}
                        />
                        <button className="mb-btn mb-btn-primary" onClick={() => onDeposit(g)}>
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs opacity-60">
                    Astuce : ajoute un dépôt après chaque paie pour rendre le plan réaliste.
                  </div>
                </div>
              );
            })}

            {!goals.length && <div className="text-sm opacity-70">Aucun objectif pour le moment.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}