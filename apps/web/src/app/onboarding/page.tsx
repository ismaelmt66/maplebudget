"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  getDefaultCategories,
  setupCategories,
  createGoal,
  completeOnboarding,
  DefaultCategory,
} from "@/lib/api";

const SUGGESTED_BUDGETS: Record<string, number> = {
  "🏠 Logement": 800,
  "🍔 Alimentation": 400,
  "🚗 Transport": 200,
  "💊 Santé": 100,
  "🎬 Loisirs": 150,
  "👕 Vêtements": 100,
  "📱 Abonnements": 80,
  "🎓 Éducation": 100,
  "💼 Épargne": 300,
  "🎁 Cadeaux": 50,
  "📦 Divers": 100,
};

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function removeEmojiPrefix(name: string): string {
  return name.replace(/^[^\s]+ /, "");
}

const SUGGESTED_GOALS = [
  { title: "Fonds d'urgence (3 mois)", target_amount: 5000 },
  { title: "Vacances", target_amount: 2000 },
  { title: "Nouvel appareil", target_amount: 1000 },
];

export default function OnboardingPage() {
  const r = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Step 2 state
  const [defaultCategories, setDefaultCategories] = useState<DefaultCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [customCategory, setCustomCategory] = useState("");

  // Step 3 state
  const [budgets, setBudgets] = useState<Record<string, string>>({});

  // Step 4 state
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getDefaultCategories()
      .then((cats) => {
        setDefaultCategories(cats);
        // Pre-select all by default
        setSelectedCategories(new Set(cats.map((c) => c.name)));
      })
      .catch(() => {});
  }, []);

  function toggleCategory(name: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function addCustomCategory() {
    const trimmed = customCategory.trim();
    if (!trimmed) return;
    setDefaultCategories((prev) => [...prev, { name: trimmed, icon: "📦" }]);
    setSelectedCategories((prev) => new Set([...prev, trimmed]));
    setCustomCategory("");
  }

  async function handleFinish() {
    try {
      setLoading(true);
      setErr(null);

      // Step 3: create categories with budgets
      const categoriesToCreate = Array.from(selectedCategories).map((name) => ({
        name,
        budget_limit: budgets[name] ? parseFloat(budgets[name]) : undefined,
      }));

      if (categoriesToCreate.length > 0) {
        await setupCategories(categoriesToCreate);
      }

      // Step 4: create goal (if filled)
      if (goalTitle.trim() && goalAmount) {
        await createGoal({
          title: goalTitle.trim(),
          target_amount: parseFloat(goalAmount),
          current_amount: 0,
          target_date: goalDate || new Date(Date.now() + MS_PER_YEAR).toISOString().split("T")[0],
        });
      }

      await completeOnboarding();
      r.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function skipToEnd() {
    try {
      setLoading(true);
      await completeOnboarding();
      r.push("/dashboard");
    } catch {
      r.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0a0f]">
      {/* Background glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-tl from-cyan-500/10 via-emerald-500/5 to-transparent blur-[100px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/40 font-medium">Étape {step} sur {totalSteps}</span>
            <div className="flex gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-8 rounded-full transition-all duration-500 ${
                    i + 1 <= step
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 md:p-12 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          {err && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <b>Erreur :</b> {err}
            </div>
          )}

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center">
              <div className="text-6xl mb-6">🎉</div>
              <h1 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                Bienvenue sur NexLeger !
              </h1>
              <p className="text-white/60 text-base leading-relaxed mb-4 max-w-md mx-auto">
                Gérez votre budget, suivez vos dépenses et atteignez vos objectifs financiers en toute simplicité.
              </p>
              <p className="text-white/40 text-sm mb-10">
                Configurons votre espace en 4 étapes rapides.
              </p>
              <div className="grid grid-cols-3 gap-4 mb-10 text-center">
                {[
                  { icon: "📂", label: "Catégories" },
                  { icon: "💰", label: "Budgets" },
                  { icon: "🎯", label: "Objectifs" },
                ].map((item) => (
                  <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className="text-xs text-white/60">{item.label}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold text-lg transition-all transform hover:-translate-y-0.5 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
              >
                Commencer 🚀
              </button>
            </div>
          )}

          {/* Step 2: Categories */}
          {step === 2 && (
            <div>
              <div className="text-4xl mb-4">📂</div>
              <h2 className="text-2xl font-bold mb-2">Choisissez vos catégories</h2>
              <p className="text-white/50 text-sm mb-6">
                Sélectionnez les catégories qui correspondent à vos dépenses habituelles.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {defaultCategories.map((cat) => {
                  const selected = selectedCategories.has(cat.name);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => toggleCategory(cat.name)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selected
                          ? "border-emerald-500/50 bg-emerald-500/10 text-white"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"
                      }`}
                    >
                      <div className="text-xl mb-1">{cat.icon}</div>
                      <div className="text-xs font-medium leading-tight">
                        {removeEmojiPrefix(cat.name)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom category */}
              <div className="flex gap-2 mb-8">
                <input
                  type="text"
                  placeholder="Ajouter une catégorie personnalisée..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomCategory()}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={addCustomCategory}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm transition-colors"
                >
                  +
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
                >
                  ← Retour
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedCategories.size === 0}
                  className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Budgets */}
          {step === 3 && (
            <div>
              <div className="text-4xl mb-4">💰</div>
              <h2 className="text-2xl font-bold mb-2">Configurez vos budgets</h2>
              <p className="text-white/50 text-sm mb-6">
                Définissez un budget mensuel pour chaque catégorie sélectionnée.
              </p>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 mb-6">
                {Array.from(selectedCategories).map((name) => {
                  const suggested = SUGGESTED_BUDGETS[name];
                  return (
                    <div
                      key={name}
                      className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4"
                    >
                      <span className="text-sm font-medium text-white/80 flex-1">{name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          placeholder={suggested ? String(suggested) : "0"}
                          value={budgets[name] ?? ""}
                          onChange={(e) =>
                            setBudgets((prev) => ({ ...prev, [name]: e.target.value }))
                          }
                          className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
                >
                  ← Retour
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold transition-all transform hover:-translate-y-0.5"
                >
                  Suivant →
                </button>
              </div>
              <button
                onClick={() => setStep(4)}
                className="w-full mt-3 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Je configurerai plus tard →
              </button>
            </div>
          )}

          {/* Step 4: First Goal */}
          {step === 4 && (
            <div>
              <div className="text-4xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold mb-2">Créez votre premier objectif</h2>
              <p className="text-white/50 text-sm mb-6">
                Un objectif financier vous motivera à mieux gérer votre budget.
              </p>

              {/* Suggested goals */}
              <div className="flex flex-wrap gap-2 mb-6">
                {SUGGESTED_GOALS.map((sg) => (
                  <button
                    key={sg.title}
                    onClick={() => {
                      setGoalTitle(sg.title);
                      setGoalAmount(String(sg.target_amount));
                    }}
                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 hover:text-white hover:border-emerald-500/50 transition-all"
                  >
                    {sg.title}
                  </button>
                ))}
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Nom de l'objectif
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Fonds d'urgence"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Montant cible ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 5000"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Date cible
                  </label>
                  <input
                    type="date"
                    value={goalDate}
                    onChange={(e) => setGoalDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
                >
                  ← Retour
                </button>
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold transition-all transform hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Finalisation...
                    </>
                  ) : (
                    "Terminer 🎉"
                  )}
                </button>
              </div>
              <button
                onClick={skipToEnd}
                disabled={loading}
                className="w-full mt-3 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Passer cette étape →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
