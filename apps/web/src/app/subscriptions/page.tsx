"use client";

import { useEffect, useState } from "react";
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

export default function SubscriptionsPage() {
    const router = useRouter();
    const [subs, setSubs] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSubs() {
            try {
                setErr(null);
                setLoading(true);
                const data = await apiFetch("/subscriptions") as Subscription[];
                setSubs(data);
            } catch (e: unknown) {
                if (e instanceof ApiError && e.status === 401) {
                    router.push("/login");
                } else {
                    setErr((e as Error)?.message ?? "Failed to load subscriptions");
                }
            } finally {
                setLoading(false);
            }
        }
        fetchSubs();
    }, [router]);

    const totalMonthly = subs.reduce((acc, s) => acc + s.monthly_cost, 0);
    const totalYearly = subs.reduce((acc, s) => acc + s.yearly_projection, 0);

    return (
        <main className="max-w-6xl mx-auto space-y-10 pb-16">
            <header className="animate-fade-in-up">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Chasseur d&apos;Abonnements</h1>
                        <p className="text-base opacity-70 mt-3 max-w-2xl">
                            Notre IA locale analyse vos transactions pour détecter automatiquement tous vos frais fixes mensuels (Netflix, Gym, etc.). Ne laissez plus aucun abonnement fantôme vampiriser votre budget !
                        </p>
                    </div>
                    <div className="flex gap-4 min-w-max">
                        <div className="p-4 rounded-3xl bg-black/40 border border-white/5 backdrop-blur-md text-right">
                            <div className="text-xs uppercase tracking-wider opacity-60 font-semibold">Mensuel Total</div>
                            <div className="text-3xl font-bold text-red-400 mt-1">${totalMonthly.toFixed(2)}</div>
                        </div>
                        <div className="p-4 rounded-3xl bg-black/40 border border-white/5 backdrop-blur-md text-right">
                            <div className="text-xs uppercase tracking-wider opacity-60 font-semibold">Impact Annuel</div>
                            <div className="text-3xl font-bold text-orange-400 mt-1">${totalYearly.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </header>

            {err && (
                <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", boxShadow: "0 0 30px rgba(239,68,68,0.1)" }}>
                    <div className="font-semibold text-red-100">Erreur</div>
                    <div className="text-sm opacity-80 mt-2 text-red-200">{err}</div>
                </div>
            )}

            {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 rounded-3xl bg-black/40 border border-white/5 animate-pulse" />
                    ))}
                </div>
            ) : subs.length === 0 ? (
                <div className="rounded-3xl p-12 text-center bg-black/40 border border-white/5 backdrop-blur-sm">
                    <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><circle cx="12" cy="12" r="10" /><path d="m4.93 4.93 14.14 14.14" /></svg>
                    </div>
                    <h3 className="text-xl font-semibold">Aucun abonnement détecté</h3>
                    <p className="opacity-60 mt-2 text-sm max-w-sm mx-auto">Ajoutez plus de transactions pour que l&apos;IA puisse repérer les paiements récurrents.</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {subs.map((s, idx) => (
                        <div key={idx} className="group rounded-3xl p-6 bg-black/40 border border-white/5 backdrop-blur-md hover:bg-white/5 hover:border-white/10 transition-all duration-300 relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:-translate-y-1">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 to-orange-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        {s.name}
                                    </h3>
                                    <div className="text-xs font-semibold uppercase tracking-wider opacity-50 mt-1">{s.category_name}</div>
                                </div>
                                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-white/70">
                                    {s.status}
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col gap-2 relative z-10">
                                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                    <div className="text-sm opacity-60">Coût Mensuel</div>
                                    <div className="font-semibold text-xl">${s.monthly_cost.toFixed(2)}</div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="text-sm opacity-60">Projection Annuelle</div>
                                    <div className="font-semibold text-orange-400 font-mono">${s.yearly_projection.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center text-xs opacity-50">
                                <span>Dernier paiement : {s.last_date}</span>
                                <button className="hover:text-red-400 transition-colors tooltip relative">Désabonnement ?</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
