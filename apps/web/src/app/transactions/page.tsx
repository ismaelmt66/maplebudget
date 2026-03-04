"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  Category,
  Transaction,
  createCategory,
  createTransaction,
  deleteTransaction,
  getCategories,
  getTransactions,
  updateTransaction,
} from "@/lib/api";

// les helpers de formatage commun sont centralisés
import { money, downloadCSV } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

export default function TransactionsPage(): React.JSX.Element {
  const [cats, setCats] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Formulaire catégories
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"income" | "expense">("expense");

  // Formulaire transaction
  const [amount, setAmount] = useState<number>(10);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // Filtres de liste
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Édition en ligne
  const [editId, setEditId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editCatId, setEditCatId] = useState<number | null>(null);

  /**
   * Fetches latest categories and transactions from the backend.
   */
  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const [c, t] = await Promise.all([getCategories(), getTransactions()]);
      setCats(c);
      setTxs(t);
      if (categoryId === null && c.length) setCategoryId(c[0].id);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        setErr("Tu dois être connecté pour gérer les transactions.");
      } else {
        setErr(e?.message ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Écouteur global pour l'ajout rapide via la HeaderBar
  useEffect(() => {
    const handleTxAdded = () => load();
    window.addEventListener('nexleger-tx-added', handleTxAdded);
    return () => window.removeEventListener('nexleger-tx-added', handleTxAdded);
  }, [load]);

  const filtered = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    return txs.filter((t) => {
      // 1. Type
      const type = t.category?.type ?? "expense";
      if (typeFilter !== "all" && type !== typeFilter) return false;

      // 2. Category
      if (catFilter !== "all" && String(t.category?.id) !== catFilter) return false;

      // 3. Date Range
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;

      // 4. Text Search
      if (!s) return true;
      const name = (t.category?.name ?? "").toLowerCase();
      const note = (t.note ?? "").toLowerCase();
      return name.includes(s) || note.includes(s) || String(t.amount).includes(s);
    });
  }, [txs, typeFilter, catFilter, dateFrom, dateTo, searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, catFilter, dateFrom, dateTo, searchQuery]);

  const paginatedTxs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  /**
   * Dispatches the category creation request.
   */
  async function onAddCategory() {
    if (!catName.trim()) return;
    try {
      setErr(null);
      await createCategory({ name: catName.trim(), type: catType });
      setCatName("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  /**
   * Dispatches the transaction creation request.
   */
  async function onAddTx() {
    if (categoryId === null) return;
    try {
      setErr(null);
      await createTransaction({
        amount,
        date,
        note: note || undefined,
        category_id: categoryId,
      });
      setNote("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  /**
   * Pre-fills the inline-edit component with a transaction's current data.
   */
  function startEdit(t: Transaction) {
    // l’objet transaction a déjà des champs fortement typés
    setEditId(t.id);
    setEditAmount(t.amount);
    setEditDate(t.date);
    setEditNote(t.note ?? "");
    setEditCatId(t.category?.id ?? null);
  }

  function cancelEdit() {
    setEditId(null);
  }

  /**
   * Submits the updated transaction payload to the backend.
   */
  async function saveEdit() {
    if (editId === null) return;
    try {
      setErr(null);
      await updateTransaction(editId, {
        amount: editAmount,
        date: editDate,
        note: editNote || undefined,
        category_id: editCatId ?? undefined,
      });
      setEditId(null);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  /**
   * Deletes a transaction after confirmation.
   */
  async function handleDeleteTransaction(id: number) {
    if (!confirm("Supprimer cette transaction ?")) return;
    try {
      setErr(null);
      await deleteTransaction(id);
      await load();
    } catch (e: any) {
      addToast(e?.message ?? "Erreur", "error");
    }
  }

  function handleExportCSV() {
    if (filtered.length === 0) {
      addToast("Aucune transaction à exporter avec les filtres actuels.", "info");
      return;
    }

    const headers = ["ID", "Date", "Catégorie", "Type", "Montant", "Note"];
    const rows = filtered.map(t => [
      t.id,
      t.date,
      `"${t.category?.name ?? "?"}"`,
      t.category?.type === "income" ? "Revenu" : "Dépense",
      t.amount,
      `"${t.note ?? ""}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadCSV(`transactions_export_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
    addToast("Export CSV réussi", "success");
  }

  return (
    <main className="space-y-10 pb-16">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-fade-in-up">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-3">Gérer</h1>
          <p className="text-sm opacity-70 mt-3">Gérez vos entrées et sorties en toute simplicité.</p>
        </div>
      </section>

      {err && (
        <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md animate-fade-in-up delay-100" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", boxShadow: "0 0 30px rgba(239,68,68,0.1)" }}>
          <div className="font-semibold text-red-100">Erreur</div>
          <div className="text-sm opacity-80 mt-2 text-red-200">{err}</div>
          <div className="mt-4">
            <Link className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold transition-transform transform hover:-translate-y-0.5 shadow-[0_0_20px_rgba(239,68,68,0.3)]" href="/login">Se connecter</Link>
          </div>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-12 animate-fade-in-up delay-200">
        {/* Left: forms */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl bg-black/40 border border-white/5 p-8 shadow-lg backdrop-blur-md">
            <div className="text-lg font-semibold mb-4">Catégories</div>

            <div className="grid gap-4">
              <input className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 px-4 rounded-xl text-sm" placeholder="ex: Loyer" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <select className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 px-4 rounded-xl text-sm" value={catType} onChange={(e) => setCatType(e.target.value as any)} title="Type de catégorie" aria-label="Type de catégorie">
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </select>
              <button className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all transform hover:-translate-y-0.5" onClick={onAddCategory}>Ajouter catégorie</button>
            </div>
          </div>

          <div className="rounded-3xl bg-black/40 border border-white/5 p-8 shadow-lg backdrop-blur-md">
            <div className="text-lg font-semibold mb-4">Ajouter une transaction</div>

            <div className="grid gap-4">
              <label className="text-sm font-medium text-white/80">
                Montant
                <input className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 py-3 px-4 rounded-xl mt-2" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </label>
              <label className="text-sm font-medium text-white/80">
                Date
                <input className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 py-3 px-4 rounded-xl mt-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="text-sm font-medium text-white/80">
                Catégorie
                <select className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 py-3 px-4 rounded-xl mt-2" value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value))}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-white/80">
                Note (optionnel)
                <input className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 py-3 px-4 rounded-xl mt-2" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all transform hover:-translate-y-0.5" onClick={onAddTx}>Ajouter</button>
            </div>
          </div>
        </div>

        {/* Right: list */}
        <div className="lg:col-span-8 rounded-3xl bg-black/40 border border-white/5 p-8 shadow-lg backdrop-blur-md">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-lg font-semibold">Historique</div>
            </div>

            <div className="flex gap-3 flex-wrap items-center">
              <button
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-2 transition-colors text-sm"
                onClick={handleExportCSV}
                title="Exporter la sélection en CSV"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span className="hidden sm:inline">Exporter la sélection</span>
              </button>

              <div className="h-6 w-px bg-white/10 mx-1 hidden lg:block"></div>

              <input type="date" className="bg-black/40 border border-white/10 py-2 px-3 rounded-xl text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Date de début" />
              <span className="text-white/50 text-sm">à</span>
              <input type="date" className="bg-black/40 border border-white/10 py-2 px-3 rounded-xl text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Date de fin" />

              <select className="bg-black/40 border border-white/10 py-2 px-3 rounded-xl text-sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} title="Filtre par catégorie" aria-label="Filtre par catégorie">
                <option value="all">Toutes les cat.</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select className="bg-black/40 border border-white/10 py-2 px-3 rounded-xl text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} title="Filtre par type" aria-label="Filtre par type">
                <option value="all">Tous types</option>
                <option value="income">Revenus</option>
                <option value="expense">Dépenses</option>
              </select>
              <input className="bg-black/40 border border-white/10 py-2 px-4 rounded-xl text-sm w-32 lg:w-48" placeholder="Recherche…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            {paginatedTxs.map((t) => {
              const id = t.id;
              const cat = t.category;
              const isIncome = (cat?.type ?? "expense") === "income";

              if (editId === id) {
                return (
                  <div key={id} className="rounded-2xl p-5 bg-white/5 border border-white/20 shadow-xl">
                    <div className="grid gap-4 md:grid-cols-4">
                      <input
                        className="bg-black/40 border border-white/10 py-2.5 px-3 rounded-lg text-sm"
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(Number(e.target.value))}
                        placeholder="Montant"
                        title="Montant"
                        aria-label="Montant"
                      />
                      <input className="bg-black/40 border border-white/10 py-2.5 px-3 rounded-lg text-sm" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} title="Date" aria-label="Date" />
                      <select className="bg-black/40 border border-white/10 py-2.5 px-3 rounded-lg text-sm" value={editCatId ?? ""} onChange={(e) => setEditCatId(Number(e.target.value))} title="Catégorie" aria-label="Catégorie">
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                        ))}
                      </select>
                      <input className="bg-black/40 border border-white/10 py-2.5 px-3 rounded-lg text-sm" placeholder="Note" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg" onClick={saveEdit}>Enregistrer</button>
                      <button className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors" onClick={cancelEdit}>Annuler</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={id} className="rounded-2xl p-5 bg-black/40 border border-white/5 hover:border-white/10 transition-colors shadow-sm group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-lg truncate group-hover:text-blue-300 transition-colors">{cat?.name ?? "?"}</div>
                      <div className="text-xs opacity-60 mt-1 uppercase tracking-wider">
                        {t.date}{t.note ? ` • ${t.note}` : ""} • {cat?.type ?? ""}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <div className="font-bold text-xl" style={{ color: isIncome ? "#4ade80" : "#f87171", textShadow: isIncome ? "0 0 10px rgba(74,222,128,0.3)" : "0 0 10px rgba(248,113,113,0.3)" }}>
                        {money(t.amount)}
                      </div>
                      <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium" onClick={() => startEdit(t)}>Éditer</button>
                        <button className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-medium border border-red-500/20" onClick={() => handleDeleteTransaction(id)}>Supprimer</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!filtered.length && <div className="text-sm opacity-60 py-8 text-center italic">Aucune transaction trouvée pour ces filtres.</div>}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 border-t border-white/10 pt-6">
              <div className="text-sm opacity-70">
                Affichage de <span className="font-semibold text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> à <span className="font-semibold text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> sur <span className="font-semibold text-white">{filtered.length}</span> résultats
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium disabled:opacity-30 disabled:hover:bg-white/5 cursor-pointer disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <div className="px-3 text-sm font-semibold opacity-80">
                  Page {currentPage} / {totalPages}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium disabled:opacity-30 disabled:hover:bg-white/5 cursor-pointer disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}