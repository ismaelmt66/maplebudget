"use client";

import { useEffect, useState, useCallback } from "react";
import { 
    getBudgetAlertsFull as getBudgetAlerts, 
    BudgetAlert, 
    BudgetAlertResponse,
    getCategories,
     updateCategory,
     createBudgetAlert,
     Category,
} from "@/lib/api";
import BudgetAlertCard from "@/components/BudgetAlertCard";
import { money } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

// --- Summary Cards (no change) ---
function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const style =
    tone === "good"
      ? { borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", boxShadow: "0 0 30px rgba(34,197,94,0.08)" }
      : tone === "bad"
      ? { borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", boxShadow: "0 0 30px rgba(239,68,68,0.08)" }
      : tone === "warn"
      ? { borderColor: "rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.08)", boxShadow: "0 0 30px rgba(234,179,8,0.08)" }
      : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" };

  return (
    <div
      className="rounded-3xl p-6 border backdrop-blur-md transition-all duration-300 hover:-translate-y-1"
      style={style as React.CSSProperties}
    >
      <div className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-2 tracking-tight text-white">{value}</div>
    </div>
  );
}

// --- Helper Functions (no change) ---
function getMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
}
const REMAINING_WARNING_THRESHOLD = 0.1;
function getSpentTone(spent: number, budget: number): "good" | "warn" | "bad" {
  if (spent > budget) return "bad";
  const ratio = budget > 0 ? spent / budget : 0;
  return ratio > 0.7 ? "warn" : "good";
}
function getRemainingTone(remaining: number, totalBudget: number): "good" | "warn" | "bad" {
  if (remaining < 0) return "bad";
  if (remaining < totalBudget * REMAINING_WARNING_THRESHOLD) return "warn";
  return "good";
}

// --- NEW: Modal for Managing Budgets ---
function ManageBudgetsModal({
    isOpen,
    onClose,
    onSave,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}) {
    const { addToast } = useToast();
    const [categories, setCategories] = useState<Category[]>([]);
    const [budgets, setBudgets] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        async function loadCats() {
            try {
                setLoading(true);
                const allCats = await getCategories();
                const expenseCats = allCats.filter(c => c.type === 'expense');
                setCategories(expenseCats);
                const initialBudgets: Record<string, string> = {};
                for (const cat of expenseCats) {
                    initialBudgets[cat.id] = cat.budget_limit?.toString() ?? "";
                }
                setBudgets(initialBudgets);
            } catch (e) {
                addToast((e as Error).message || "Erreur de chargement", "error");
                onClose();
            } finally {
                setLoading(false);
            }
        }
        loadCats();
    }, [isOpen, onClose, addToast]);

    const handleBudgetChange = (catId: number, value: string) => {
        setBudgets(prev => ({ ...prev, [catId]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        const promises = [];
        for (const cat of categories) {
            const originalBudget = cat.budget_limit?.toString() ?? "";
            const newBudgetStr = budgets[cat.id] ?? "";
            if (originalBudget !== newBudgetStr) {
                const newBudget = newBudgetStr ? parseFloat(newBudgetStr) : null;
                promises.push(updateCategory(cat.id, { budget_limit: newBudget }));
                if (newBudget && newBudget > 0) {
                    promises.push(createBudgetAlert({ category_id: cat.id, monthly_limit: newBudget }));
                }
                // TODO: Add logic to delete budget alert if newBudget is null/0
            }
        }

        try {
            await Promise.all(promises);
            addToast("Budgets mis à jour avec succès !", "success");
            onSave();
            onClose();
        } catch (e) {
            addToast((e as Error).message || "Erreur lors de la sauvegarde", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gérer les Budgets Mensuels">
            {loading ? (
                <div className="text-center p-8 text-white/50">Chargement...</div>
            ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between gap-4">
                            <label htmlFor={`budget-${cat.id}`} className="text-sm text-white/80 truncate">{cat.name}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">$</span>
                                <input
                                    id={`budget-${cat.id}`}
                                    type="number"
                                    min="0"
                                    step="10"
                                    value={budgets[cat.id] ?? ""}
                                    onChange={e => handleBudgetChange(cat.id, e.target.value)}
                                    placeholder="Aucun"
                                    className="w-32 rounded-xl bg-white/5 border border-white/10 text-white text-sm text-right pr-3 pl-7 py-2 focus:outline-none focus:border-indigo-500/50 transition-all"
                                />
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={onClose}>Annuler</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? "Sauvegarde..." : "Sauvegarder"}</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}


// --- Main Budget Page Component ---
export default function BudgetPage() {
  const [data, setData] = useState<BudgetAlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getBudgetAlerts();
      setData(result);
    } catch {
      setError("Erreur lors du chargement des budgets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alertCount = data
    ? data.alerts.filter((a: BudgetAlert) => a.status !== "safe").length
    : 0;
  const remaining = data ? data.total_budget - data.total_spent : 0;

  return (
    <main className="mb-container py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">💰 Suivi des Budgets</h1>
          <p className="text-white/50 mt-1 text-sm">
            {data ? getMonthLabel(data.month ?? new Date().toISOString().slice(0, 7)) : "Chargement…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                </svg>
                Actualiser
            </Button>
            <Button onClick={() => setIsManageModalOpen(true)}>
                Gérer les budgets
            </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Budgété" value={money(data.total_budget)} tone="neutral" />
          <SummaryCard
            label="Total Dépensé"
            value={money(data.total_spent)}
            tone={getSpentTone(data.total_spent, data.total_budget)}
          />
          <SummaryCard
            label="Restant"
            value={money(remaining)}
            tone={getRemainingTone(remaining, data.total_budget)}
          />
          <SummaryCard
            label="Catégories en alerte"
            value={String(alertCount)}
            tone={alertCount === 0 ? "good" : alertCount <= 2 ? "warn" : "bad"}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 text-white/40">
            <div className="w-10 h-10 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm">Chargement des budgets…</span>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-3xl bg-red-500/10 border border-red-500/20 p-6 text-center text-red-300">
          <p className="text-sm">{error}</p>
          <button onClick={load} className="mt-3 text-xs underline opacity-70 hover:opacity-100">
            Réessayer
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.alerts.length === 0 && (
        <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-12 flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">💡</span>
          <h2 className="text-xl font-semibold text-white/80">Aucun budget configuré</h2>
          <p className="text-sm text-white/40 max-w-sm">
            Définissez des limites de budget sur vos catégories pour suivre vos dépenses ici.
          </p>
          <Button onClick={() => setIsManageModalOpen(true)} size="lg" className="mt-2">
            Configurer les budgets
          </Button>
        </div>
      )}

      {/* Budget cards grid */}
      {!loading && !error && data && data.alerts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.alerts.map((alert: BudgetAlert) => (
            <BudgetAlertCard key={alert.category_id} alert={alert} />
          ))}
        </div>
      )}

      <ManageBudgetsModal 
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        onSave={() => load()}
      />
    </main>
  );
}
