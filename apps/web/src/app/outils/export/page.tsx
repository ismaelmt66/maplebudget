"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { downloadTransactionsCSV, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ExportPage() {
  const router = useRouter();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleExport() {
    try {
      setErr(null);
      setSuccess(false);
      setLoading(true);
      const opts: { from_date?: string; to_date?: string } = {};
      if (fromDate) opts.from_date = fromDate;
      if (toDate) opts.to_date = toDate;
      await downloadTransactionsCSV(opts);
      setSuccess(true);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/login");
      } else {
        setErr((e as Error)?.message ?? "Erreur lors de l'export");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mb-container py-10 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Export des Donnees</span>
        </h1>
        <p className="text-white/50 mt-1">Telechargez vos transactions au format CSV</p>
      </div>

      {/* Export Card */}
      <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-8 max-w-2xl">
        <h2 className="text-lg font-bold mb-2">Export CSV des Transactions</h2>
        <p className="text-sm text-white/40 mb-6">
          Exportez vos transactions avec filtrage par date. Le fichier CSV peut etre ouvert dans Excel, Google Sheets ou tout autre tableur.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Date de debut (optionnel)</label>
              <Input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Date de fin (optionnel)</label>
              <Input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/8 text-sm text-white/50">
            <div className="flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-white/30">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              <div>
                Sans dates, toutes vos transactions seront exportees. Le fichier inclut : date, description, montant, categorie, et type.
              </div>
            </div>
          </div>

          {err && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{err}</div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              Export termine avec succes. Verifiez votre dossier de telechargements.
            </div>
          )}

          <Button onClick={handleExport} disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Export en cours...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Telecharger le CSV
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Format Info */}
      <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 max-w-2xl">
        <h3 className="text-md font-bold mb-3">Format du fichier</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-4 text-white/40 font-medium">Colonne</th>
                <th className="text-left py-2 text-white/40 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-white/60">
              <tr className="border-b border-white/5"><td className="py-2 pr-4 font-mono text-xs text-indigo-400">date</td><td className="py-2">Date de la transaction (YYYY-MM-DD)</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4 font-mono text-xs text-indigo-400">description</td><td className="py-2">Description du mouvement</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4 font-mono text-xs text-indigo-400">amount</td><td className="py-2">Montant (positif = revenu, negatif = depense)</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4 font-mono text-xs text-indigo-400">category</td><td className="py-2">Nom de la categorie</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs text-indigo-400">type</td><td className="py-2">income ou expense</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
