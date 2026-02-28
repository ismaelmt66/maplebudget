"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Goal, GoalPlan, createGoal, deleteGoal, getGoalPlan, getGoals, updateGoal } from "@/lib/api";

const LOCALE = "fr-CA";
const CURRENCY = "CAD";

function money(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}

function pct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Record<number, GoalPlan>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

      // fetch plans for each goal
      const planPairs = await Promise.all(
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
      for (const [id, p] of planPairs) if (p) next[id] = p;
      setPlans(next);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  async function onDeposit(goal: Goal) {
    const dep = Number(depositByGoal[goal.id] ?? 0);
    if (!dep || dep <= 0) return;

    try {
      setErr(null);
      await updateGoal(goal.id, { current_amount: Number(goal.current_amount) + dep });
      setDepositByGoal((m) => ({ ...m, [goal.id]: 0 }));
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

  const totalTargets = useMemo(() => goals.reduce((s, g) => s + Number(g.target_amount), 0), [goals]);
  const totalCurrent = useMemo(() => goals.reduce((s, g) => s + Number(g.current_amount), 0), [goals]);

  return (
    <main className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Objectifs</h1>
          <p className="text-sm opacity-70 mt-1">
            Plan mensuel + suivi + dépôts. (Multi-utilisateur : chacun ses objectifs.)
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={load}
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            disabled={loading}
          >
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
          <Link href="/dashboard" className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition">
            Dashboard
          </Link>
          <Link href="/transactions" className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition">
            Transactions
          </Link>
        </div>
      </section>

      {err && (
        <div className="border rounded-2xl p-4 text-sm">
          <b>Erreur:</b> {err}
        </div>
      )}

      {/* Overview */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-2xl p-5">
          <div className="text-sm opacity-70">Total objectifs</div>
          <div className="text-2xl font-semibold mt-1">{money(totalTargets)}</div>
        </div>
        <div className="border rounded-2xl p-5">
          <div className="text-sm opacity-70">Déjà épargné</div>
          <div className="text-2xl font-semibold mt-1">{money(totalCurrent)}</div>
        </div>
        <div className="border rounded-2xl p-5">
          <div className="text-sm opacity-70">Progression globale</div>
          <div className="text-2xl font-semibold mt-1">{pct(totalCurrent, totalTargets).toFixed(1)}%</div>
        </div>
      </section>

      {/* Create goal */}
      <section className="border rounded-3xl p-6">
        <div className="font-semibold">Créer un objectif</div>
        <div className="text-sm opacity-70 mt-1">Ex: Voiture, Épargne de sécurité, Frais de scolarité…</div>

        <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
          <label>
            Titre
            <input className="mt-1 w-full border rounded-xl px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label>
            Montant cible
            <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} />
          </label>

          <label>
            Déjà épargné
            <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={currentAmount} onChange={(e) => setCurrentAmount(Number(e.target.value))} />
          </label>

          <label>
            Date cible
            <input type="date" className="mt-1 w-full border rounded-xl px-3 py-2" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </label>
        </div>

        <button onClick={onCreate} className="mt-4 border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition">
          Créer
        </button>
      </section>

      {/* Goals list */}
      <section className="border rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold">Mes objectifs</div>
            <div className="text-sm opacity-70 mt-1">Plan calculé automatiquement (mois restants + épargne mensuelle).</div>
          </div>
          <div className="text-sm opacity-70">{goals.length} objectif(s)</div>
        </div>

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="text-sm opacity-70">Chargement…</div>
          ) : goals.length === 0 ? (
            <div className="text-sm opacity-70">Aucun objectif pour le moment.</div>
          ) : (
            goals.map((g) => {
              const p = plans[g.id];
              const prog = pct(Number(g.current_amount), Number(g.target_amount));
              const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));

              return (
                <div key={g.id} className="border rounded-3xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">{g.title}</div>
                      <div className="text-sm opacity-70 mt-1">
                        Cible: {money(Number(g.target_amount))} • Épargné: {money(Number(g.current_amount))} • Reste: {money(remaining)}
                      </div>
                      <div className="text-xs opacity-60 mt-1">Date cible: {g.target_date}</div>
                    </div>

                    <button
                      onClick={() => onDelete(g.id)}
                      className="border rounded-xl px-3 py-2 text-sm hover:bg-black/5 transition"
                    >
                      Supprimer
                    </button>
                  </div>

                  <div className="mt-4 h-2 rounded-full bg-black/10 overflow-hidden">
                    <div className="h-full bg-black/60" style={{ width: `${prog}%` }} />
                  </div>
                  <div className="text-xs opacity-60 mt-2">{prog.toFixed(1)}% complété</div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                    <div className="border rounded-2xl p-4">
                      <div className="text-xs opacity-70">Mois restants</div>
                      <div className="text-lg font-semibold mt-1">{p ? p.months_remaining : "—"}</div>
                    </div>
                    <div className="border rounded-2xl p-4">
                      <div className="text-xs opacity-70">Épargne mensuelle requise</div>
                      <div className="text-lg font-semibold mt-1">{p ? money(p.monthly_required) : "—"}</div>
                    </div>
                    <div className="border rounded-2xl p-4">
                      <div className="text-xs opacity-70">Action: dépôt</div>
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          className="flex-1 border rounded-xl px-3 py-2 text-sm"
                          placeholder="ex: 50"
                          value={depositByGoal[g.id] ?? 0}
                          onChange={(e) => setDepositByGoal((m) => ({ ...m, [g.id]: Number(e.target.value) }))}
                        />
                        <button
                          onClick={() => onDeposit(g)}
                          className="border rounded-xl px-3 py-2 text-sm hover:bg-black/5 transition"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs opacity-60">
                    Astuce : ajoute un dépôt après chaque paie. Le plan se met à jour automatiquement.
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}