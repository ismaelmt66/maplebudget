"use client";

import React from "react";
import { useEffect, useState } from "react";
import {
  ApiError,
  RecurringTransaction,
  createRecurringTransaction,
  deleteRecurringTransaction,
  detectRecurringTransactions,
  getRecurringTransactions,
  updateRecurringTransaction,
} from "@/lib/api";
import { money } from "@/lib/format";
import RecurringTransactionCard from "@/components/RecurringTransactionCard";
import { useToast } from "@/components/ui/Toast";

type StatusFilter = "all" | "active" | "paused" | "ended";

export default function RecurringPage(): React.JSX.Element {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const { addToast } = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formFrequency, setFormFrequency] = useState("monthly");
  const [formNextOcc, setFormNextOcc] = useState("");
  const [formCategoryName, setFormCategoryName] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const data = await getRecurringTransactions();
      setItems(data);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        setErr("Tu dois être connecté pour voir les transactions récurrentes.");
      } else {
        setErr(e?.message ?? "Erreur lors du chargement.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDetect() {
    try {
      setDetecting(true);
      const detected = await detectRecurringTransactions();
      addToast(`${detected.length} transaction(s) récurrente(s) détectée(s) !`, "success");
      await load();
    } catch (e: any) {
      addToast(e?.message ?? "Erreur lors de la détection.", "error");
    } finally {
      setDetecting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || formAmount <= 0) return;

    try {
      setFormSubmitting(true);
      await createRecurringTransaction({
        name: formName.trim(),
        amount: formAmount,
        frequency: formFrequency,
        next_occurrence: formNextOcc || null,
        category_name: formCategoryName.trim() || null,
      });
      addToast("Transaction récurrente ajoutée !", "success");
      setShowModal(false);
      setFormName("");
      setFormAmount(0);
      setFormFrequency("monthly");
      setFormNextOcc("");
      setFormCategoryName("");
      await load();
    } catch (e: any) {
      addToast(e?.message ?? "Erreur lors de la création.", "error");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleTogglePause(id: number, currentStatus: string) {
    const newStatus = currentStatus === "paused" ? "active" : "paused";
    try {
      await updateRecurringTransaction(id, { status: newStatus });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: newStatus } : x)));
      addToast(newStatus === "paused" ? "Transaction mise en pause." : "Transaction reprise.", "success");
    } catch (e: any) {
      addToast(e?.message ?? "Erreur lors de la mise à jour.", "error");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteRecurringTransaction(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      addToast("Transaction récurrente supprimée.", "success");
    } catch (e: any) {
      addToast(e?.message ?? "Erreur lors de la suppression.", "error");
    }
  }

  const filtered = filter === "all" ? items : items.filter((x) => x.status === filter);

  const totalMonthly = items
    .filter((x) => x.status === "active")
    .reduce((sum, x) => {
      const amt = Number(x.amount);
      switch (x.frequency) {
        case "daily": return sum + amt * 30;
        case "weekly": return sum + amt * 4.33;
        case "biweekly": return sum + amt * 2.17;
        case "monthly": return sum + amt;
        case "quarterly": return sum + amt / 3;
        case "yearly": return sum + amt / 12;
        default: return sum + amt;
      }
    }, 0);

  return (
    <main className="mb-container py-10 space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Transactions Récurrentes</h1>
          <p className="text-white/50 text-sm mt-1">Gérez et suivez vos paiements réguliers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-500/40 transition-all disabled:opacity-60"
          >
            {detecting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "🔍"
            )}
            {detecting ? "Détection…" : "Détecter"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            ➕ Ajouter
          </button>
        </div>
      </div>

      {/* Error state */}
      {err && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-red-300 text-sm">
          {err}
        </div>
      )}

      {/* Summary card */}
      {!loading && items.length > 0 && (
        <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-6 flex flex-col sm:flex-row gap-6">
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-white">{items.length}</div>
            <div className="text-xs text-white/40 mt-1 uppercase tracking-wider">Total récurrentes</div>
          </div>
          <div className="w-px bg-white/5 hidden sm:block" />
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-white">{items.filter((x) => x.status === "active").length}</div>
            <div className="text-xs text-white/40 mt-1 uppercase tracking-wider">Actives</div>
          </div>
          <div className="w-px bg-white/5 hidden sm:block" />
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-indigo-300">{money(totalMonthly)}</div>
            <div className="text-xs text-white/40 mt-1 uppercase tracking-wider">Coût mensuel estimé</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "active", "paused", "ended"] as StatusFilter[]).map((s) => {
          const labels: Record<StatusFilter, string> = {
            all: "Tous",
            active: "Actifs",
            paused: "Pausés",
            ended: "Terminés",
          };
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={[
                "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
                filter === s
                  ? "bg-white/10 text-white border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                  : "text-white/50 border-white/5 hover:bg-white/5 hover:text-white/80",
              ].join(" ")}
            >
              {labels[s]}
              <span className="ml-1.5 text-xs opacity-60">
                {s === "all" ? items.length : items.filter((x) => x.status === s).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl bg-white/3 border border-white/5 p-6 h-56 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !err && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-5xl opacity-30">🔄</div>
          <div className="text-white/50 text-sm max-w-xs">
            {filter === "all"
              ? `Aucune transaction récurrente pour l'instant. Clique sur "Détecter" pour analyser tes transactions existantes.`
              : `Aucune transaction avec le statut "${filter}".`}
          </div>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <RecurringTransactionCard
              key={item.id}
              item={item}
              onTogglePause={handleTogglePause}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-[#0a0a0a] border border-white/10 p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Nouvelle transaction récurrente</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Nom *</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Loyer, Netflix, Gym…"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Montant *</label>
                <input
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={formAmount || ""}
                  onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Fréquence *</label>
                <select
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="biweekly">Bimensuel</option>
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="yearly">Annuel</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Prochaine occurrence</label>
                <input
                  type="date"
                  value={formNextOcc}
                  onChange={(e) => setFormNextOcc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Catégorie</label>
                <input
                  value={formCategoryName}
                  onChange={(e) => setFormCategoryName(e.target.value)}
                  placeholder="Ex: Logement, Loisirs…"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={formSubmitting || !formName.trim() || formAmount <= 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-60 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              >
                {formSubmitting ? "Ajout en cours…" : "Ajouter"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
