"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Category,
  Transaction,
  getCategories,
  getTransactions,
  createCategory,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/api";

const LOCALE = "fr-CA";
const CURRENCY = "CAD";

function money(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toCSV(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Tx = Transaction & { amountNum: number; catType: string; catName: string };

function SkeletonRow() {
  return <div className="h-12 rounded-2xl border bg-black/[0.03]" />;
}

export default function TransactionsPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create category
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"income" | "expense">("expense");

  // create tx
  const [amount, setAmount] = useState(10);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  // edit mode
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eAmount, setEAmount] = useState<number>(0);
  const [eDate, setEDate] = useState<string>("");
  const [eNote, setENote] = useState<string>("");
  const [eCategoryId, setECategoryId] = useState<number | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const [c, t] = await Promise.all([getCategories(), getTransactions()]);
      setCats(c);

      const normalized: Tx[] = t.map((x) => ({
        ...(x as any),
        amountNum: Number((x as any).amount),
        catType: (x as any).category?.type ?? "expense",
        catName: (x as any).category?.name ?? "?",
      }));

      setTxs(normalized);
      if (categoryId === null && c.length) setCategoryId(c[0].id);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived / filtered list
  const filtered = useMemo(() => {
    let out = [...txs];

    if (fromDate) out = out.filter((t) => t.date >= fromDate);
    if (toDate) out = out.filter((t) => t.date <= toDate);

    if (typeFilter !== "all") out = out.filter((t) => t.catType === typeFilter);

    const s = q.trim().toLowerCase();
    if (s) {
      out = out.filter((t) => {
        const blob = `${t.catName} ${t.note ?? ""} ${t.date}`.toLowerCase();
        return blob.includes(s);
      });
    }

    if (sortBy === "date_desc") out.sort((a, b) => b.date.localeCompare(a.date));
    if (sortBy === "date_asc") out.sort((a, b) => a.date.localeCompare(b.date));
    if (sortBy === "amount_desc") out.sort((a, b) => b.amountNum - a.amountNum);
    if (sortBy === "amount_asc") out.sort((a, b) => a.amountNum - b.amountNum);

    return out;
  }, [txs, fromDate, toDate, typeFilter, q, sortBy]);

  // insights
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.catType === "income") income += t.amountNum;
      else expense += t.amountNum;
    }
    const net = income - expense;

    // biggest tx
    let biggest: Tx | null = null;
    for (const t of filtered) if (!biggest || t.amountNum > biggest.amountNum) biggest = t;

    return { income, expense, net, biggest, count: filtered.length };
  }, [filtered]);

  const canCreateTx = useMemo(() => categoryId !== null && !!date && amount > 0, [categoryId, date, amount]);

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
    if (!canCreateTx || categoryId === null) return;
    try {
      setErr(null);
      await createTransaction({ amount, date, note: note || undefined, category_id: categoryId });
      setNote("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  function startEdit(t: Tx) {
    setEditingId(t.id);
    setEAmount(t.amountNum);
    setEDate(t.date);
    setENote(t.note ?? "");
    setECategoryId(t.category?.id ?? null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (editingId === null) return;
    try {
      setErr(null);
      await updateTransaction(editingId, {
        amount: eAmount,
        date: eDate,
        note: eNote || undefined,
        category_id: eCategoryId ?? undefined,
      });
      setEditingId(null);
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

  function exportCSV() {
    const rows = filtered.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amountNum,
      category: t.catName,
      type: t.catType,
      note: t.note ?? "",
    }));
    downloadTextFile("transactions.csv", toCSV(rows) || "id,date,amount,category,type,note\n");
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Transactions</h1>
          <p className="text-sm opacity-70 mt-1">
            CRUD complet, filtres, export, édition — style “produit”.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={load}
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            disabled={loading}
          >
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
          <button
            onClick={exportCSV}
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
            title="Exporter les transactions filtrées"
          >
            Export CSV
          </button>
          <Link
            href="/dashboard"
            className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
          >
            Dashboard
          </Link>
        </div>
      </section>

      {err && (
        <div className="border rounded-2xl p-4 text-sm">
          <b>Erreur:</b> {err}
        </div>
      )}

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-4">
        {loading ? (
          <>
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
          </>
        ) : (
          <>
            <div className="border rounded-2xl p-5">
              <div className="text-sm opacity-70">Revenus (filtrés)</div>
              <div className="text-2xl font-semibold mt-1">{money(stats.income)}</div>
            </div>
            <div className="border rounded-2xl p-5">
              <div className="text-sm opacity-70">Dépenses (filtrées)</div>
              <div className="text-2xl font-semibold mt-1">{money(stats.expense)}</div>
            </div>
            <div className="border rounded-2xl p-5">
              <div className="text-sm opacity-70">Net</div>
              <div className="text-2xl font-semibold mt-1">{money(stats.net)}</div>
            </div>
            <div className="border rounded-2xl p-5">
              <div className="text-sm opacity-70">Transactions</div>
              <div className="text-2xl font-semibold mt-1">{stats.count}</div>
              <div className="text-xs opacity-60 mt-2">
                {stats.biggest ? `Max: ${money(stats.biggest.amountNum)} (${stats.biggest.catName})` : "—"}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Create blocks */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Categories */}
        <div className="border rounded-3xl p-6">
          <div className="font-semibold">Catégories</div>
          <div className="text-sm opacity-70 mt-1">Créer et réutiliser pour classifier tes transactions.</div>

          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 border rounded-xl px-3 py-2 text-sm"
              placeholder="ex: Loyer, Salaire, Courses…"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
            <select
              className="border rounded-xl px-3 py-2 text-sm"
              value={catType}
              onChange={(e) => setCatType(e.target.value as any)}
              aria-label="Type de catégorie"
            >
              <option value="expense">expense</option>
              <option value="income">income</option>
            </select>
            <button className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition" onClick={onAddCategory}>
              Ajouter
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {cats.map((c) => (
              <div key={c.id} className="border rounded-2xl px-4 py-3 flex justify-between text-sm">
                <span className="truncate">{c.name}</span>
                <span className="opacity-70">{c.type}</span>
              </div>
            ))}
            {!cats.length && <div className="text-sm opacity-70">Aucune catégorie.</div>}
          </div>
        </div>

        {/* Create transaction */}
        <div className="border rounded-3xl p-6">
          <div className="font-semibold">Ajouter une transaction</div>
          <div className="text-sm opacity-70 mt-1">Ajoute un mouvement (dépense ou revenu).</div>

          <div className="mt-4 grid gap-3 text-sm">
            <label>
              Montant
              <input
                type="number"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>

            <label>
              Date
              <input
                type="date"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label>
              Catégorie
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                aria-label="Catégorie de la transaction"
                value={categoryId !== null ? String(categoryId) : ""}
                onChange={(e) => setCategoryId(Number(e.target.value))}
              >
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Note (optionnel)
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <button
              className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition disabled:opacity-50"
              disabled={!canCreateTx}
              onClick={onAddTx}
              title={!canCreateTx ? "Choisis une catégorie, une date et un montant > 0" : ""}
            >
              Ajouter
            </button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold">Recherche & filtres</div>
            <div className="text-sm opacity-70 mt-1">Affiner la liste pour analyser rapidement.</div>
          </div>
          <div className="text-sm opacity-70">
            {filtered.length} / {txs.length}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <label className="text-sm md:col-span-2">
            Recherche
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="catégorie, note, date…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <label className="text-sm">
            Type
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                aria-label="Filtrer par type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">Tous</option>
              <option value="income">Revenus</option>
              <option value="expense">Dépenses</option>
            </select>
          </label>

          <label className="text-sm">
            De
            <input
              type="date"
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>

          <label className="text-sm">
            À
            <input
              type="date"
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          <label className="text-sm md:col-span-2">
            Tri
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                aria-label="Trier les transactions"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="date_desc">Date (desc)</option>
              <option value="date_asc">Date (asc)</option>
              <option value="amount_desc">Montant (desc)</option>
              <option value="amount_asc">Montant (asc)</option>
            </select>
          </label>

          <div className="md:col-span-3 flex items-end justify-end gap-2">
            <button
              className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
              onClick={() => { setQ(""); setTypeFilter("all"); setFromDate(""); setToDate(""); setSortBy("date_desc"); }}
              title="Réinitialiser filtres"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* Table/List */}
      <section className="border rounded-3xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold">Liste</div>
            <div className="text-sm opacity-70 mt-1">Clique “Edit” pour modifier, “Delete” pour supprimer.</div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {loading ? (
            <>
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </>
          ) : filtered.length === 0 ? (
            <div className="text-sm opacity-70">Aucune transaction (avec ces filtres).</div>
          ) : (
            filtered.map((t) => {
              const isEditing = editingId === t.id;

              return (
                <div key={t.id} className="border rounded-2xl px-4 py-3">
                  {!isEditing ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {t.catName} <span className="text-xs opacity-60">({t.catType})</span>
                        </div>
                        <div className="text-xs opacity-70 mt-1 truncate">
                          {t.date}{t.note ? ` • ${t.note}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="font-semibold">{money(t.amountNum)}</div>
                        <button
                          className="border rounded-xl px-3 py-2 text-xs hover:bg-black/5 transition"
                          onClick={() => startEdit(t)}
                        >
                          Edit
                        </button>
                        <button
                          className="border rounded-xl px-3 py-2 text-xs hover:bg-black/5 transition"
                          onClick={() => removeTx(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-5 text-sm">
                      <label className="md:col-span-1">
                        Montant
                        <input
                          type="number"
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                          value={eAmount}
                          onChange={(e) => setEAmount(Number(e.target.value))}
                        />
                      </label>

                      <label className="md:col-span-1">
                        Date
                        <input
                          type="date"
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                          value={eDate}
                          onChange={(e) => setEDate(e.target.value)}
                        />
                      </label>

                      <label className="md:col-span-2">
                        Catégorie
                        <select
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                          value={eCategoryId !== null ? String(eCategoryId) : ""}
                          onChange={(e) => setECategoryId(Number(e.target.value))}
                          title="Sélectionner une catégorie"
                          aria-label="Catégorie de la transaction"
                        >
                          {cats.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {c.name} ({c.type})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="md:col-span-1">
                        Note
                        <input
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                          value={eNote}
                          onChange={(e) => setENote(e.target.value)}
                        />
                      </label>

                      <div className="md:col-span-5 flex justify-end gap-2">
                        <button
                          className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
                          onClick={cancelEdit}
                        >
                          Annuler
                        </button>
                        <button
                          className="border rounded-xl px-4 py-2 text-sm hover:bg-black/5 transition"
                          onClick={saveEdit}
                        >
                          Sauvegarder
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}