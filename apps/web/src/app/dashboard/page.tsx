"use client";

import { useEffect, useState } from "react";
import { Dashboard, getDashboard } from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setErr(e?.message ?? "Erreur"));
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {err && <div className="mt-4 border rounded-md p-3 text-sm"><b>Erreur:</b> {err}</div>}
      {!data ? (
        <div className="mt-6">Chargement…</div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="border rounded-xl p-4">
              <div className="text-sm opacity-70">Revenus</div>
              <div className="text-xl font-semibold">{data.income_total.toFixed(2)}</div>
            </div>
            <div className="border rounded-xl p-4">
              <div className="text-sm opacity-70">Dépenses</div>
              <div className="text-xl font-semibold">{data.expense_total.toFixed(2)}</div>
            </div>
            <div className="border rounded-xl p-4">
              <div className="text-sm opacity-70">Solde (net)</div>
              <div className="text-xl font-semibold">{data.net.toFixed(2)}</div>
            </div>
          </section>

          <section className="mt-6 border rounded-xl p-4">
            <h2 className="font-medium">Totaux par catégorie</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.by_category.map((c) => (
                <li key={c.category_id} className="border rounded-md px-3 py-2 flex justify-between">
                  <span>{c.name} <span className="opacity-60">({c.type})</span></span>
                  <span>{c.total.toFixed(2)}</span>
                </li>
              ))}
              {!data.by_category.length && <li className="opacity-70">Aucune donnée.</li>}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}