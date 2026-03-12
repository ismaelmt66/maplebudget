"use client";

import { useEffect, useState } from "react";
import {
  getRecurringTransactions,
  createRecurringTransaction,
  detectRecurringTransactions,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  RecurringTransaction,
} from "@/lib/api";
import RecurringTransactionCard from "@/components/RecurringTransactionCard";
import { useToast } from "@/components/ui/Toast";

type FilterStatus = "all" | "active" | "paused" | "ended";

const FREQUENCIES = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Bimensuel" },
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "yearly", label: "Annuel" },
];

export default function RecurringPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form state
  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly",
    next_occurrence: "",
    category_name: "",
  });
  const [formLoading, setFormLoading] = useState(false);

  async function loadItems() {
    try {
      setLoading(true);
      const data = await getRecurringTransactions();
      setItems(data);
    } catch {
      addToast("Erreur lors du chargement des transactions récurrentes", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDetect() {
    try {
      setDetecting(true);
      const detected = await detectRecurringTransactions();
      addToast(`${detected.length} transaction(s) récurrente(s) détectée(s)`, "success");
      await loadItems();
    } catch {
      addToast("Erreur lors de la détection", "error");
    } finally {
      setDetecting(false);
    }
  }

  async function handleAdd() {
    if (!form.name || !form.amount || !form.frequency) return;
    try {
      setFormLoading(true);
      await createRecurringTransaction({
        name: form.name,
        amount: parseFloat(form.amount),
        frequency: form.frequency,
        next_occurrence: form.next_occurrence || null,
        category_name: form.category_name || null,
      });
      addToast("Transaction récurrente ajoutée", "success");
      setShowAddModal(false);
      setForm({ name: "", amount: "", frequency: "monthly", next_occurrence: "", category_name: "" });
      await loadItems();
    } catch {
      addToast("Erreur lors de l'ajout", "error");
    } finally {
      setFormLoading(false);
    }
  }

  async function handlePause(id: number) {
    try {
      await updateRecurringTransaction(id, { status: "paused" });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "paused" } : i)));
      addToast("Transaction pausée", "success");
    } catch {
      addToast("Erreur lors de la mise en pause", "error");
    }
  }

  async function handleResume(id: number) {
    try {
      await updateRecurringTransaction(id, { status: "active" });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "active" } : i)));
      addToast("Transaction reprise", "success");
    } catch {
      addToast("Erreur lors de la reprise", "error");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette transaction récurrente ?")) return;
    try {
      await deleteRecurringTransaction(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      addToast("Transaction supprimée", "success");
    } catch {
      addToast("Erreur lors de la suppression", "error");
    }
  }

  const filtered =
    filterStatus === "all" ? items : items.filter((i) => i.status === filterStatus);

  const filters: { value: FilterStatus; label: string; count: number }[] = [
    { value: "all", label: "Tous", count: items.length },
    { value: "active", label: "Actifs", count: items.filter((i) => i.status === "active").length },
    { value: "paused", label: "Pausés", count: items.filter((i) => i.status === "paused").length },
    { value: "ended", label: "Terminés", count: items.filter((i) => i.status === "ended").length },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Transactions Récurrentes
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            Abonnements, loyers et paiements périodiques détectés automatiquement
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-all disabled:opacity-60"
          >
            {detecting ? (
              <>
                <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Détection...
              </>
            ) : (
              <>🔍 Détecter</>
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all"
          >
            ➕ Ajouter
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={[
              "flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all border",
              filterStatus === f.value
                ? "bg-white/10 text-white border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "text-white/50 border-white/5 hover:border-white/10 hover:text-white/80",
            ].join(" ")}
          >
            {f.label}
            <span
              className={[
                "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                filterStatus === f.value
                  ? "bg-indigo-500/30 text-indigo-300"
                  : "bg-white/10 text-white/40",
              ].join(" ")}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 p-16 text-center">
          <div className="text-5xl mb-4">🔄</div>
          <div className="text-white/60 text-lg font-medium mb-2">
            Aucune transaction récurrente{filterStatus !== "all" ? ` (${filters.find((f) => f.value === filterStatus)?.label.toLowerCase()})` : ""}
          </div>
          <p className="text-white/30 text-sm max-w-sm mx-auto">
            Cliquez sur &quot;🔍 Détecter&quot; pour analyser automatiquement vos transactions,
            ou ajoutez-en une manuellement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rt) => (
            <RecurringTransactionCard
              key={rt.id}
              recurring={rt}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div className="w-full max-w-md rounded-3xl bg-[#0a0a0a] border border-white/10 p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Nouvelle transaction récurrente</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Nom *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Netflix, Loyer, Gym..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Montant (CAD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Fréquence *</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all appearance-none"
                >
                  {FREQUENCIES.map((freq) => (
                    <option key={freq.value} value={freq.value} className="bg-[#0a0a0a]">
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Prochaine occurrence</label>
                <input
                  type="date"
                  value={form.next_occurrence}
                  onChange={(e) => setForm((f) => ({ ...f, next_occurrence: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Catégorie</label>
                <input
                  type="text"
                  value={form.category_name}
                  onChange={(e) => setForm((f) => ({ ...f, category_name: e.target.value }))}
                  placeholder="ex: Loisirs, Transport..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={formLoading || !form.name || !form.amount}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? "Ajout..." : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
