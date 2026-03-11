"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, createGoal, deleteGoal, getGoalPlan, getGoals, updateGoal, Goal, GoalPlan } from "@/lib/api";

// importer les helpers de formatage partagés du module commun
import { money } from "@/lib/format";
function pct(cur: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (cur / target) * 100));
}

export default function GoalsPage(): React.JSX.Element {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Record<number, GoalPlan>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  // formulaire de création
  const [title, setTitle] = useState("Voiture");
  const [targetAmount, setTargetAmount] = useState(8000);
  const [currentAmount, setCurrentAmount] = useState(500);
  const [targetDate, setTargetDate] = useState("2026-12-01");

  // dépôt par objectif
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
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        setErr("Tu dois être connecté pour gérer les objectifs.");
      } else {
        setErr((e as Error)?.message ?? "Erreur");
      }
    } finally {
      setErr(null);
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

  /**
   * Creates a new savings goal and refreshes the list in-place.
   */
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
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Erreur");
    }
  }

  /**
   * Adds the partial current value set in the inline input into the matched target.
   */
  async function onDeposit(g: Goal) {
    const dep = Number(depositByGoal[g.id] ?? 0);
    if (!dep || dep <= 0) return;

    try {
      setErr(null);
      await updateGoal(g.id, { current_amount: Number(g.current_amount) + dep });
      setDepositByGoal((m) => ({ ...m, [g.id]: 0 }));
      await load();
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Erreur");
    }
  }

  /**
   * Prompts prior to deleting an active target securely.
   */
  async function onDelete(goalId: number) {
    if (!confirm("Supprimer cet objectif ?")) return;
    try {
      setErr(null);
      await deleteGoal(goalId);
      await load();
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Erreur");
    }
  }

  return (
    <main className="space-y-10 pb-16">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-fade-in-up">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-3">Objectifs</h1>
          <p className="text-sm opacity-70 mt-3">Dépôts réguliers et suivi de la progression globale.</p>
        </div>
      </section>

      {err && (
        <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md animate-fade-in-up delay-100" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", boxShadow: "0 0 30px rgba(239,68,68,0.1)" }}>
          <div className="font-semibold text-red-100">Erreur</div>
          <div className="text-sm opacity-80 mt-2 text-red-200">{err}</div>
          <div className="mt-4">
            <Link className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-transform transform hover:-translate-y-0.5" href="/login">Se connecter</Link>
          </div>
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-3 animate-fade-in-up delay-100">
        <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md border border-white/10 bg-white/5 shadow-[0_0_30px_rgba(255,255,255,0.02)] transition-all duration-300 hover:-translate-y-1 hover:brightness-110">
          <div className="text-sm opacity-70 font-medium tracking-wide uppercase">Total objectifs</div>
          <div className="text-3xl font-bold mt-2 tracking-tight">{money(totals.target)}</div>
        </div>
        <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md border border-blue-500/30 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all duration-300 hover:-translate-y-1 hover:brightness-110">
          <div className="text-sm opacity-70 text-blue-200 font-medium tracking-wide uppercase">Déjà épargné</div>
          <div className="text-3xl font-bold mt-2 tracking-tight text-blue-100">{money(totals.cur)}</div>
        </div>
        <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md border border-green-500/30 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.1)] transition-all duration-300 hover:-translate-y-1 hover:brightness-110">
          <div className="text-sm opacity-70 text-green-200 font-medium tracking-wide uppercase">Progression globale</div>
          <div className="text-3xl font-bold mt-2 tracking-tight text-green-100">{totals.p.toFixed(1)}%</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12 animate-fade-in-up delay-200">
        {/* Create */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl bg-black/40 border border-white/5 p-8 shadow-lg backdrop-blur-md">
            <div className="text-lg font-semibold mb-4">Créer un objectif</div>

            <div className="grid gap-4">
              <label className="text-sm font-medium text-white/80">
                Titre
                <input className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 px-4 rounded-xl mt-2" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="text-sm font-medium text-white/80">
                Montant cible
                <input className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 px-4 rounded-xl mt-2" type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} />
              </label>
              <label className="text-sm font-medium text-white/80">
                Déjà épargné
                <input className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 px-4 rounded-xl mt-2" type="number" value={currentAmount} onChange={(e) => setCurrentAmount(Number(e.target.value))} />
              </label>
              <label className="text-sm font-medium text-white/80">
                Date cible
                <input className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 px-4 rounded-xl mt-2" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </label>

              <button className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all transform hover:-translate-y-0.5" onClick={onCreate}>Créer l&apos;objectif</button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-8 rounded-3xl bg-black/40 border border-white/5 p-8 shadow-lg backdrop-blur-md">
          <div className="flex items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-lg font-semibold">Mes objectifs en cours</div>
            </div>
          </div>

          <div className="space-y-6">
            {goals.map((g) => {
              const plan = plans[g.id];
              const prog = pct(Number(g.current_amount), Number(g.target_amount));
              const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));

              return (
                <div key={g.id} className="rounded-3xl bg-white/5 border border-white/10 p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                    <div className="min-w-0 flex-1">
                      <div className="text-2xl font-bold truncate tracking-tight">{g.title}</div>
                      <div className="text-sm opacity-70 mt-2 font-medium">
                        Cible : <span className="text-white">{money(Number(g.target_amount))}</span> &nbsp;•&nbsp;
                        Épargné : <span className="text-blue-300">{money(Number(g.current_amount))}</span> &nbsp;•&nbsp;
                        Reste : <span className="text-purple-300">{money(remaining)}</span>
                      </div>
                      <div className="text-xs opacity-50 mt-1 uppercase tracking-wider">Date cible : {g.target_date}</div>
                    </div>
                    <button className="px-4 py-2 shrink-0 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm font-medium border border-red-500/20 transition-colors" onClick={() => onDelete(g.id)}>Supprimer</button>
                  </div>

                  <div className="mt-6 h-3 rounded-full bg-black/50 overflow-hidden relative z-10 border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(96,165,250,0.4)]"
                      style={{
                        width: `${prog}%`,
                        background: "linear-gradient(90deg, #3b82f6, #a855f7)",
                      }}
                    />
                  </div>
                  <div className="text-right text-xs opacity-60 mt-2 font-medium">{prog.toFixed(1)}% complété</div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3 relative z-10">
                    <div className="rounded-2xl bg-black/40 border border-white/5 p-5">
                      <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">Mois restants</div>
                      <div className="text-2xl font-bold mt-2 text-white">{plan ? plan.months_remaining : "—"}</div>
                    </div>
                    <div className="rounded-2xl bg-black/40 border border-white/5 p-5">
                      <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">Effort Mensuel</div>
                      <div className="text-2xl font-bold mt-2 text-white">{plan ? money(plan.monthly_required) : "—"}</div>
                    </div>
                    <div className="rounded-2xl bg-black/40 border border-white/5 p-5 flex flex-col justify-center">
                      <div className="text-xs opacity-70 uppercase tracking-wider font-semibold mb-2">Dépôt Rapide</div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 py-2 px-3 rounded-xl text-sm"
                          placeholder="ex: 50"
                          value={depositByGoal[g.id] ?? 0}
                          onChange={(e) => setDepositByGoal((m) => ({ ...m, [g.id]: Number(e.target.value) }))}
                        />
                        <button className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg transition-colors" onClick={() => onDeposit(g)}>
                          Valider
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!goals.length && <div className="text-sm opacity-60 font-medium py-10 text-center italic">Aucun objectif d&apos;épargne. Créez-en un pour commencer à investir dans votre futur.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}