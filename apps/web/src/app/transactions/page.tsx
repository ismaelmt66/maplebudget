"use client";

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

const LOCALE = "fr-CA";
const CURRENCY = "CAD";
function money(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}

export default function TransactionsPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Category form
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"income" | "expense">("expense");

  // Tx form
  const [amount, setAmount] = useState<number>(10);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // List filters
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [q, setQ] = useState("");

  // Inline edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editCatId, setEditCatId] = useState<number | null>(null);

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return txs.filter((t) => {
      const type = (t as any).category?.type ?? "expense";
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (!s) return true;
      const name = ((t as any).category?.name ?? "").toLowerCase();
      const note = ((t as any).note ?? "").toLowerCase();
      return name.includes(s) || note.includes(s) || String((t as any).amount).includes(s);
    });
  }, [txs, typeFilter, q]);

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

  function startEdit(t: Transaction) {
    setEditId((t as any).id);
    setEditAmount(Number((t as any).amount));
    setEditDate((t as any).date);
    setEditNote((t as any).note ?? "");
    setEditCatId((t as any).category?.id ?? null);
  }

  function cancelEdit() {
    setEditId(null);
  }

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

  async function removeTx(id: number) {
    if (!confirm("Supprimer cette transaction ?")) return;
    try {
      setErr(null);
      await deleteTransaction(id);
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
            <span className="mb-badge">Transactions</span>
            <span className="mb-badge">{filtered.length} élément(s)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-3">Gérer</h1>
          <p className="text-sm opacity-70 mt-2">Ajout rapide, édition simple, historique lisible.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link className="mb-btn" href="/dashboard">Dashboard</Link>
          <Link className="mb-btn" href="/goals">Goals</Link>
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

      <section className="grid gap-4 lg:grid-cols-12">
        {/* Left: forms */}
        <div className="lg:col-span-4 space-y-4">
          <div className="mb-card-soft p-6">
            <div className="text-base font-semibold">Catégories</div>
            <div className="text-sm opacity-70 mt-1">Crée tes catégories (income/expense).</div>

            <div className="mt-4 grid gap-3">
              <input className="mb-input" placeholder="ex: Loyer" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <select className="mb-input" value={catType} onChange={(e) => setCatType(e.target.value as any)} title="Type de catégorie" aria-label="Type de catégorie">
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </select>
              <button className="mb-btn mb-btn-primary" onClick={onAddCategory}>Ajouter catégorie</button>
            </div>

            <div className="mt-4 text-xs opacity-60">
              Astuce : commence avec “Salaire”, “Loyer”, “Courses”, “Transport”.
            </div>
          </div>

          <div className="mb-card-soft p-6">
            <div className="text-base font-semibold">Ajouter une transaction</div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                Montant
                <input className="mb-input mt-1" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </label>
              <label className="text-sm">
                Date
                <input className="mb-input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="text-sm">
                Catégorie
                <select className="mb-input mt-1" value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value))}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Note (optionnel)
                <input className="mb-input mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button className="mb-btn mb-btn-primary" onClick={onAddTx}>Ajouter</button>
            </div>
          </div>
        </div>

        {/* Right: list */}
        <div className="lg:col-span-8 mb-card-soft p-6">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <div className="text-base font-semibold">Historique</div>
              <div className="text-sm opacity-70 mt-1">Filtre et édite rapidement.</div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <select className="mb-input w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} title="Filtre par type" aria-label="Filtre par type">
                <option value="all">Tous</option>
                <option value="income">Revenus</option>
                <option value="expense">Dépenses</option>
              </select>
              <input className="mb-input w-60" placeholder="Recherche…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filtered.map((t) => {
              const id = (t as any).id as number;
              const cat = (t as any).category;
              const isIncome = (cat?.type ?? "expense") === "income";

              if (editId === id) {
                return (
                  <div key={id} className="mb-card-soft p-4">
                    <div className="grid gap-3 md:grid-cols-4">
                        <input
                          className="mb-input"
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(Number(e.target.value))}
                          placeholder="Montant"
                          title="Montant"
                          aria-label="Montant"
                        />
                        <input className="mb-input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} title="Date" aria-label="Date" />
                      <select className="mb-input" value={editCatId ?? ""} onChange={(e) => setEditCatId(Number(e.target.value))} title="Catégorie" aria-label="Catégorie">
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                        ))}
                      </select>
                      <input className="mb-input" placeholder="Note" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button className="mb-btn mb-btn-primary" onClick={saveEdit}>Enregistrer</button>
                      <button className="mb-btn" onClick={cancelEdit}>Annuler</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={id} className="mb-card-soft p-4 mb-lift">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{cat?.name ?? "?"}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {(t as any).date}{(t as any).note ? ` • ${(t as any).note}` : ""} • {cat?.type ?? ""}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold" style={{ color: isIncome ? "rgb(var(--mb-good))" : "rgb(var(--mb-warn))" }}>
                        {money(Number((t as any).amount))}
                      </div>
                      <div className="mt-2 flex gap-2 justify-end">
                        <button className="mb-btn" onClick={() => startEdit(t)}>Edit</button>
                        <button className="mb-btn mb-btn-danger" style={{ borderColor: "rgba(239,68,68,0.25)" }} onClick={() => removeTx(id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!filtered.length && <div className="text-sm opacity-70">Aucune transaction.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}