"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";

type Subscription = {
  name: string;
  monthly_cost: number;
  yearly_projection: number;
  status: string;
  has_price_hike: boolean;
  category_name: string;
  last_date: string;
};

function money(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSubs = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const data = await apiFetch("/analytics/subscriptions") as Subscription[];
      setSubs(data);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/login");
      } else {
        setErr((e as Error)?.message ?? "Impossible de charger les abonnements");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const totalMonthly = subs.reduce((acc, s) => acc + s.monthly_cost, 0);
  const totalYearly = subs.reduce((acc, s) => acc + s.yearly_projection, 0);

  async function generateSampleTransactions() {
    try {
      setGenerating(true);
      setErr(null);
      setSuccess(null);
      // Create sample recurring transactions via the transactions endpoint
      const categories = await apiFetch("/categories") as { id: number; name: string; type: string }[];
      const expenseCat = categories.find((c) => c.type === "expense");
      if (!expenseCat) {
        setErr("Créez d'abord une catégorie de dépenses pour générer des abonnements test.");
        return;
      }
      // Create 3 recurring transactions 30 days apart for 3 months
      const services = [
        { note: "Netflix", amount: 17.99 },
        { note: "Spotify", amount: 10.99 },
        { note: "Gym Mensuel", amount: 45.00 },
      ];
      const now = new Date();
      for (const svc of services) {
        for (let i = 0; i < 3; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i * 30);
          const date = d.toISOString().split("T")[0];
          await apiFetch("/transactions", {
            method: "POST",
            body: JSON.stringify({ amount: svc.amount, date, note: svc.note, category_id: expenseCat.id }),
          });
        }
      }
      setSuccess("3 abonnements tests générés ! Rafraîchissement en cours...");
      setTimeout(fetchSubs, 800);
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto space-y-10 pb-16">

      {/* Header */}
      <header className="animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Chasseur d&apos;Abonnements</h1>
            <p className="text-base opacity-60 mt-3 max-w-2xl leading-relaxed">
              Notre IA analyse vos transactions pour détecter automatiquement tous vos frais récurrents.
              Ne laissez plus aucun abonnement fantôme vampiriser votre budget.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                onClick={fetchSubs}
                disabled={loading}
                className="mb-btn mb-btn-primary gap-2"
              >
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? "Analyse..." : "Rafraîchir"}
              </button>
              <button
                onClick={generateSampleTransactions}
                disabled={generating || loading}
                className="mb-btn gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {generating ? "Génération..." : "Générer transactions test"}
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="flex gap-4 shrink-0">
            <div className="p-5 rounded-2xl bg-black/40 border border-white/8 backdrop-blur-md text-right min-w-[140px]">
              <div className="text-xs uppercase tracking-wider opacity-50 font-semibold">Mensuel</div>
              <div className="text-2xl font-bold text-red-400 mt-1">{money(totalMonthly)}</div>
            </div>
            <div className="p-5 rounded-2xl bg-black/40 border border-white/8 backdrop-blur-md text-right min-w-[140px]">
              <div className="text-xs uppercase tracking-wider opacity-50 font-semibold">Annuel</div>
              <div className="text-2xl font-bold text-orange-400 mt-1">{money(totalYearly)}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {err && (
        <div className="rounded-2xl p-5 border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
          <span className="font-semibold">Erreur : </span>{err}
        </div>
      )}
      {success && (
        <div className="rounded-2xl p-5 border border-green-500/30 bg-green-500/10 text-green-200 text-sm">
          {success}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-3xl bg-black/40 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="rounded-3xl p-14 text-center bg-black/30 border border-white/5 backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
              <circle cx="12" cy="12" r="10" /><path d="m4.93 4.93 14.14 14.14" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold opacity-80">Aucun abonnement détecté</h3>
          <p className="opacity-50 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
            L&apos;IA cherche des transactions avec le même libellé sur 2+ mois consécutifs (±30 jours).
            Utilisez le bouton ci-dessus pour générer des données test.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {subs.map((s, idx) => (
            <div
              key={idx}
              className="group rounded-3xl p-6 bg-black/40 border border-white/5 backdrop-blur-md hover:border-white/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              {/* Top accent */}
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-500/60 to-orange-500/60 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex justify-between items-start gap-3 mb-5">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold truncate">{s.name}</h3>
                  <div className="text-xs font-medium uppercase tracking-wider opacity-40 mt-0.5">{s.category_name}</div>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${
                  s.has_price_hike
                    ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                    : "bg-white/5 border-white/10 text-white/60"
                }`}>
                  {s.has_price_hike ? "⚠ Hausse" : s.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-white/6 pb-3">
                  <span className="text-sm opacity-60">Coût mensuel</span>
                  <span className="font-bold text-lg">{money(s.monthly_cost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-60">Impact annuel</span>
                  <span className="font-semibold text-orange-400">{money(s.yearly_projection)}</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/8 flex justify-between items-center">
                <span className="text-xs opacity-40">Dernier : {s.last_date}</span>
                <button className="text-xs opacity-50 hover:opacity-100 hover:text-red-400 transition-all">
                  Annuler ?
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
