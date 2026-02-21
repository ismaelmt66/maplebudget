"use client";

import { useEffect, useState } from "react";
import { getCategories, getTransactions, createCategory, createTransaction, Category, Transaction } from "@/lib/api";

export default function TransactionsPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"income" | "expense">("expense");

  const [amount, setAmount] = useState(10);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  async function refresh() {
    const [c, t] = await Promise.all([getCategories(), getTransactions()]);
    setCats(c);
    setTxs(t);
    if (categoryId === null && c.length) setCategoryId(c[0].id);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e?.message ?? "Erreur"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addCategory() {
    if (!catName.trim()) return;
    try {
      setErr(null);
      await createCategory({ name: catName.trim(), type: catType });
      setCatName("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  async function addTx() {
    if (categoryId === null) return;
    try {
      setErr(null);
      await createTransaction({ amount, date, note: note || undefined, category_id: categoryId });
      setNote("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Transactions</h1>

      {err && <div className="mt-4 border rounded-md p-3 text-sm"><b>Erreur:</b> {err}</div>}

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="border rounded-xl p-4">
          <h2 className="font-medium">Catégories</h2>

          <div className="mt-3 flex gap-2">
            <input className="flex-1 border rounded-md px-3 py-2 text-sm" placeholder="ex: Loyer"
              value={catName} onChange={(e) => setCatName(e.target.value)} />
            <select className="border rounded-md px-3 py-2 text-sm" value={catType}
              onChange={(e) => setCatType(e.target.value as any)}>
              <option value="expense">expense</option>
              <option value="income">income</option>
            </select>
            <button className="border rounded-md px-3 py-2 text-sm" onClick={addCategory}>Ajouter</button>
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            {cats.map((c) => (
              <li key={c.id} className="border rounded-md px-3 py-2 flex justify-between">
                <span>{c.name}</span><span className="opacity-70">{c.type}</span>
              </li>
            ))}
            {!cats.length && <li className="opacity-70">Aucune catégorie.</li>}
          </ul>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-medium">Ajouter une transaction</h2>

          <div className="mt-3 grid gap-2 text-sm">
            <label>
              Montant
              <input type="number" className="w-full border rounded-md px-3 py-2 mt-1"
                value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>

            <label>
              Date
              <input type="date" className="w-full border rounded-md px-3 py-2 mt-1"
                value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label>
              Catégorie
              <select className="w-full border rounded-md px-3 py-2 mt-1"
                value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value))}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type})</option>

</div>

          <ul className="mt-4 space-y-2 text-sm">
            {cats.map((c) => (
              <li key={c.id} className="border rounded-md px-3 py-2 flex justify-between">
                <span>{c.name}</span><span className="opacity-70">{c.type}</span>
              </li>
            ))}
            {!cats.length && <li className="opacity-70">Aucune catégorie.</li>}
          </ul>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-medium">Ajouter une transaction</h2>

          <div className="mt-3 grid gap-2 text-sm">
            <label>
              Montant
              <input type="number" className="w-full border rounded-md px-3 py-2 mt-1"
                value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>

            <label>
              Date
              <input type="date" className="w-full border rounded-md px-3 py-2 mt-1"
                value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label>
              Catégorie
              <select className="w-full border rounded-md px-3 py-2 mt-1"
                value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value))}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                ))}
              </select>
            </label>

            <label>
              Note (optionnel)
              <input className="w-full border rounded-md px-3 py-2 mt-1"
                value={note} onChange={(e) => setNote(e.target.value)} />
            </label>

            <button className="border rounded-md px-3 py-2 mt-2" onClick={addTx}>Ajouter</button>
          </div>

          <h3 className="mt-6 font-medium">Historique</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {txs.map((t) => (
              <li key={t.id} className="border rounded-md px-3 py-2">
                <div className="flex justify-between">
                  <span className="font-medium">{t.category?.name ?? "?"}</span>
                  <span>{Number(t.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between opacity-70">
                  <span>{t.date}</span>
                  <span>{t.note ?? ""}</span>
                </div>
              </li>
            ))}
            {!txs.length && <li className="opacity-70">Aucune transaction.</li>}
          </ul>
        </div>
      </section>
    </main>
  );
}
