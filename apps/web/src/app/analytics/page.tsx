"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, Transaction, Subscription, getSubscriptions } from "@/lib/api";
import { money } from "@/lib/format";

export default function AnalyticsPage() {
    const router = useRouter();
    const [txs, setTxs] = useState<Transaction[]>([]);
    const [subs, setSubs] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setErr(null);
                setLoading(true);
                const [data, subsData] = await Promise.all([
                    apiFetch("/transactions"),
                    getSubscriptions()
                ]);
                setTxs(data as Transaction[]);
                setSubs(subsData);
            } catch (e: any) {
                if (e instanceof ApiError && e.status === 401) {
                    router.push("/login");
                } else {
                    setErr(e?.message ?? "Erreur de chargement");
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [router]);

    // Aggregate data by Year-Month (e.g. "2023-10")
    const monthlyData = useMemo(() => {
        const map = new Map<string, { income: number; expense: number }>();

        for (const t of txs) {
            if (!t.date || t.date.length < 7) continue;
            const ym = t.date.substring(0, 7); // "YYYY-MM"

            const type = t.category?.type ?? "expense";
            const amt = t.amount;

            if (!map.has(ym)) map.set(ym, { income: 0, expense: 0 });
            const current = map.get(ym)!;

            if (type === "income") current.income += amt;
            else current.expense += amt;
        }

        // Sort chronologically
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([ym, data]) => ({ month: ym, ...data }));
    }, [txs]);

    // Calculate max value for chart scaling
    const maxVal = useMemo(() => {
        if (monthlyData.length === 0) return 100;
        return Math.max(...monthlyData.map(d => Math.max(d.income, d.expense))) * 1.05; // 5% padding
    }, [monthlyData]);

    return (
        <main className="max-w-5xl mx-auto space-y-10 pb-16">
            <header className="animate-fade-in-up">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Analytique</h1>
                <p className="text-sm opacity-70 mt-3">
                    Analyse tes flux de trésorerie sur le long terme. Suis ta progression mois par mois.
                </p>
            </header>

            {err && (
                <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md animate-fade-in-up delay-100" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", boxShadow: "0 0 30px rgba(239,68,68,0.1)" }}>
                    <div className="font-semibold text-red-100">Erreur</div>
                    <div className="text-sm opacity-80 mt-2 text-red-200">{err}</div>
                </div>
            )}

            {loading ? (
                <div className="text-sm opacity-60 py-12 text-center rounded-3xl bg-black/40 border border-white/5 animate-pulse">
                    Construction des rapports...
                </div>
            ) : (
                <>
                    {monthlyData.length === 0 ? (
                        <div className="text-sm opacity-60 py-12 text-center rounded-3xl bg-black/40 border border-white/5 italic">
                            Pas de données suffisantes pour l'analyse. Ajoute des transactions.
                        </div>
                    ) : (
                        <section className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 shadow-xl p-8 animate-fade-in-up delay-100">
                            <h2 className="text-xl font-bold mb-8">Revenus vs Dépenses (Mensuel)</h2>

                            <div className="relative w-full overflow-x-auto pb-6 pt-4">
                                <div className="flex items-end gap-8 min-w-max h-[400px] border-b border-white/10 px-4 pt-24">
                                    {monthlyData.map((d) => {
                                        const incomeH = (d.income / maxVal) * 100;
                                        const expenseH = (d.expense / maxVal) * 100;
                                        const net = d.income - d.expense;

                                        return (
                                            <div key={d.month} className="flex flex-col items-center gap-3 group h-full">
                                                <div className="flex items-end justify-center gap-2 h-64 w-20 hover:bg-white/5 rounded-xl transition-colors relative">
                                                    {/* Tooltip on hover */}
                                                    <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full mb-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl text-sm whitespace-nowrap z-50 pointer-events-none">
                                                        <div className="font-bold mb-2 border-b border-white/10 pb-2 text-white/90">{d.month}</div>
                                                        <div className="text-blue-300">Revenus: {money(d.income)}</div>
                                                        <div className="text-purple-300">Dépenses: {money(d.expense)}</div>
                                                        <div className="mt-2 pt-2 border-t border-white/10 font-bold" style={{ color: net >= 0 ? "#60a5fa" : "#c084fc" }}>
                                                            Net: {money(net)}
                                                        </div>
                                                    </div>

                                                    {/* Income Bar */}
                                                    <div
                                                        className="w-6 rounded-t-md transition-all duration-700 ease-out shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-gradient-to-t from-blue-600/50 to-blue-400 group-hover:brightness-125"
                                                        style={{ height: `${incomeH}%` }}
                                                    />
                                                    {/* Expense Bar */}
                                                    <div
                                                        className="w-6 rounded-t-md transition-all duration-700 ease-out shadow-[0_0_20px_rgba(168,85,247,0.3)] bg-gradient-to-t from-purple-600/50 to-purple-400 group-hover:brightness-125"
                                                        style={{ height: `${expenseH}%` }}
                                                    />
                                                </div>
                                                {/* X-axis Label */}
                                                <span className="text-xs font-semibold opacity-60 uppercase tracking-widest">{d.month}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Y-axis rough guideline */}
                                <div className="absolute top-0 right-0 text-xs font-mono opacity-50 px-2 py-1 bg-white/5 rounded-lg border border-white/10">Max: {money(maxVal)}</div>
                            </div>

                            <div className="mt-8 flex items-center justify-center gap-8 text-sm font-medium">
                                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                                    <span className="block w-3 h-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] bg-blue-400"></span>
                                    Revenus
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                                    <span className="block w-3 h-3 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)] bg-purple-400"></span>
                                    Dépenses
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Subscriptions Bento Grid */}
                    {subs.length > 0 && (
                        <section className="animate-fade-in-up delay-200">
                            <header className="mb-6 flex items-end justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight">Abonnements Détectés</h2>
                                    <p className="text-sm opacity-70 mt-1">Identification automatique des prélèvements récurrents via IA.</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm opacity-60 block">Coût Annuel Projeté</span>
                                    <span className="text-xl font-bold text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                        {money(subs.reduce((acc, s) => acc + s.yearly_projection, 0))}
                                    </span>
                                </div>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {subs.map((sub, idx) => (
                                    <div
                                        key={idx}
                                        className="relative group rounded-3xl p-6 overflow-hidden bg-black/40 backdrop-blur-md border border-white/5 hover:border-white/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                                                <span className="text-xl font-black opacity-80 uppercase">{sub.name.substring(0, 2)}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${sub.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-white/40 border-white/5'}`}>
                                                    {sub.status === 'active' ? 'Actif' : 'Inactif'}
                                                </div>
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold capitalize mb-1">{sub.name}</h3>
                                        <div className="text-sm opacity-60 mb-6">{sub.category_name} • Dernier: {sub.last_date}</div>

                                        <div className="flex items-end justify-between pt-4 border-t border-white/10">
                                            <div>
                                                <div className="text-xs opacity-50 uppercase tracking-widest mb-1">Mensuel</div>
                                                <div className="text-2xl font-black tracking-tight">{money(sub.monthly_cost)}</div>
                                            </div>

                                            {sub.has_price_hike && (
                                                <div className="animate-pulse flex items-center gap-1 text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-lg border border-red-400/20">
                                                    <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                                                    Hausse Détectée
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </main>
    );
}
