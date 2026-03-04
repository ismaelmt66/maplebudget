"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, Asset, getAssets, createAsset, updateAsset, deleteAsset } from "@/lib/api";
import { money } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function AssetsPage() {
    const router = useRouter();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Modal state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [formData, setFormData] = useState({ name: "", type: "checking", balance: "" });

    const load = async () => {
        try {
            setLoading(true);
            setErr(null);
            const data = await getAssets();
            setAssets(data);
        } catch (e: any) {
            if (e instanceof ApiError && e.status === 401) {
                router.push("/login");
            } else {
                setErr(e.message || "Failed to load assets");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                type: formData.type,
                balance: parseFloat(formData.balance) || 0
            };

            if (editingAsset) {
                await updateAsset(editingAsset.id, payload);
            } else {
                await createAsset(payload);
            }
            setIsAddOpen(false);
            setEditingAsset(null);
            load();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer ce compte ? L'historique sera perdu.")) return;
        try {
            await deleteAsset(id);
            setAssets(prev => prev.filter(a => a.id !== id));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const openEdit = (a: Asset) => {
        setEditingAsset(a);
        setFormData({ name: a.name, type: a.type, balance: a.balance.toString() });
        setIsAddOpen(true);
    };

    // Calculate total net worth
    const totalNetWorth = useMemo(() => {
        return assets.reduce((acc, a) => acc + (a.type !== 'liability' ? a.balance : -a.balance), 0);
    }, [assets]);

    // Format type
    const formatType = (t: string) => {
        const types: Record<string, string> = {
            checking: 'Compte Courant',
            savings: 'Épargne',
            stock: 'Bourse / Placements',
            crypto: 'Crypto-monnaies',
            liability: 'Dette / Emprunt'
        };
        return types[t] || t;
    };

    const getTypeColor = (t: string) => {
        const colors: Record<string, string> = {
            checking: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
            savings: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
            stock: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400',
            crypto: 'from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400',
            liability: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-400'
        };
        return colors[t] || 'from-white/10 to-transparent border-white/10 text-white';
    };

    // Prepare wealth curve data (aggregate daily history across all assets)
    const curveData = useMemo(() => {
        if (!assets.length) return [];

        // Dictionary mapping date -> net worth
        const dateMap: Record<string, number> = {};

        // Pre-fill the map with 0s for all dates where any asset has a history point
        // This is a naive approach; a robust one would carry forward previous balances
        assets.forEach(a => {
            a.history?.forEach(h => {
                dateMap[h.date] = 0;
            });
        });

        // For each date, sum the nearest previous or exact balance of each asset
        const sortedDates = Object.keys(dateMap).sort();

        // Track the "current" balance of each asset as we iterate chronologically
        const currentBalances: Record<number, number> = {};

        const finalData = sortedDates.map(date => {
            assets.forEach(a => {
                // Find if this asset has a history entry for this date
                const entry = a.history?.find(h => h.date === date);
                if (entry) {
                    currentBalances[a.id] = (a.type !== 'liability' ? entry.balance : -entry.balance);
                }
            });

            // Sum all known balances at this date
            const nw = Object.values(currentBalances).reduce((acc, val) => acc + val, 0);
            return { date, value: nw };
        });

        return finalData;
    }, [assets]);

    const maxCurveVal = useMemo(() => {
        if (!curveData.length) return 100;
        return Math.max(...curveData.map(d => d.value)) * 1.05;
    }, [curveData]);

    const minCurveVal = useMemo(() => {
        if (!curveData.length) return 0;
        const m = Math.min(...curveData.map(d => d.value));
        return m > 0 ? m * 0.95 : m;
    }, [curveData]);

    // Simple SVG Path generator
    const generatePath = () => {
        if (curveData.length < 2) return "";
        const w = 1000;
        const h = 250;
        const range = maxCurveVal - minCurveVal;

        const points = curveData.map((d, i) => {
            const x = (i / (curveData.length - 1)) * w;
            const y = h - ((d.value - minCurveVal) / range) * h;
            return `${x},${y}`;
        });

        return `M ${points.join(" L ")}`;
    };

    return (
        <main className="max-w-6xl mx-auto space-y-10 pb-16">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Patrimoine</h1>
                    <p className="text-sm opacity-70 mt-3">
                        Suis l'évolution globale de ta richesse.
                    </p>
                </div>
                <div className="text-left md:text-right">
                    <span className="text-sm uppercase tracking-widest opacity-60 font-bold mb-1 block">Net Worth</span>
                    <span className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
                        {money(totalNetWorth)}
                    </span>
                </div>
            </header>

            {err && (
                <div className="rounded-3xl p-6 bg-red-500/10 border border-red-500/30 text-red-200">
                    {err}
                </div>
            )}

            {loading ? (
                <div className="animate-pulse flex items-center justify-center p-12 bg-white/5 rounded-3xl border border-white/10">
                    Chargement du portefeuille...
                </div>
            ) : (
                <>
                    {/* Wealth Curve */}
                    {curveData.length > 2 && (
                        <section className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden animate-fade-in-up delay-100">
                            <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                                <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                                    <path d="M3 3v18h18" />
                                    <path d="m19 9-5 5-4-4-3 3" />
                                </svg>
                            </div>

                            <h2 className="text-xl font-bold mb-8">Croissance Globale</h2>

                            <div className="w-full h-[250px] relative">
                                <svg viewBox="0 0 1000 250" className="w-full h-full preserve-3d overflow-visible">
                                    <defs>
                                        <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(52, 211, 153, 0.4)" />
                                            <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
                                        </linearGradient>
                                        <filter id="glow">
                                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                            <feMerge>
                                                <feMergeNode in="coloredBlur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>

                                    {/* Area */}
                                    <path
                                        d={`${generatePath()} L 1000,250 L 0,250 Z`}
                                        fill="url(#wealthGrad)"
                                        className="animate-fade-in"
                                        style={{ animationDuration: "1.5s" }}
                                    />

                                    {/* Line */}
                                    <path
                                        d={generatePath()}
                                        fill="none"
                                        stroke="#34d399"
                                        strokeWidth="4"
                                        filter="url(#glow)"
                                        className="animate-dash"
                                        strokeDasharray="2500"
                                        strokeDashoffset="0"
                                    />
                                </svg>
                            </div>

                            <div className="flex justify-between mt-4 text-xs font-mono opacity-50 px-2">
                                <span>{curveData[0]?.date}</span>
                                <span>{curveData[curveData.length - 1]?.date}</span>
                            </div>
                        </section>
                    )}

                    {/* Assets Grid */}
                    <section className="animate-fade-in-up delay-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Comptes & Actifs</h2>
                            <Button
                                onClick={() => {
                                    setEditingAsset(null);
                                    setFormData({ name: "", type: "checking", balance: "" });
                                    setIsAddOpen(true);
                                }}
                            >
                                + Ajouter
                            </Button>
                        </div>

                        {assets.length === 0 ? (
                            <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10 opacity-70">
                                Aucun actif enregistré. Clique sur "Ajouter" pour commencer.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {assets.map(a => (
                                    <div
                                        key={a.id}
                                        className={`group relative overflow-hidden rounded-[2rem] p-6 bg-gradient-to-br ${getTypeColor(a.type)} backdrop-blur-xl border hover:scale-[1.02] transition-all duration-300 shadow-xl cursor-pointer`}
                                        onClick={() => openEdit(a)}
                                    >
                                        <div className="absolute inset-0 bg-black/40 z-0"></div>

                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="uppercase tracking-widest text-xs font-bold opacity-80">
                                                    {formatType(a.type)}
                                                </div>
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-full transition-all"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                                                    </svg>
                                                </button>
                                            </div>

                                            <h3 className="text-xl font-semibold mb-1 text-white truncate">{a.name}</h3>

                                            <div className="mt-8">
                                                <div className="text-3xl font-black tracking-tight text-white mb-2">
                                                    {money(a.balance)}
                                                </div>
                                                {a.history && a.history.length > 1 && (
                                                    <div className="text-xs font-semibold backdrop-blur-md inline-block px-2 py-1 rounded bg-black/30 border border-white/10">
                                                        {(a.balance - a.history[a.history.length - 2].balance) > 0 ? (
                                                            <span className="text-emerald-400">↗ +{money(a.balance - a.history[a.history.length - 2].balance)}</span>
                                                        ) : (
                                                            <span className="text-red-400">↘ {money(a.balance - a.history[a.history.length - 2].balance)}</span>
                                                        )}
                                                        <span className="ml-1 opacity-50">vs last update</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* Modal Add/Edit Asset */}
            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={editingAsset ? "Modifier l'actif" : "Nouvel Actif"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium mb-form-label">Nom de l'actif</label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData(pr => ({ ...pr, name: e.target.value }))}
                            required
                            placeholder="Ex: Livret A, Binance, etc."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium mb-form-label">Type</label>
                        <select
                            className="mb-input"
                            value={formData.type}
                            onChange={(e) => setFormData(pr => ({ ...pr, type: e.target.value }))}
                        >
                            <option value="checking">Compte Courant</option>
                            <option value="savings">Épargne</option>
                            <option value="stock">Bourse / Placements</option>
                            <option value="crypto">Crypto-monnaies</option>
                            <option value="liability">Dette / Emprunt</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium mb-form-label">Solde Actuel</label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.balance}
                            onChange={(e) => setFormData(pr => ({ ...pr, balance: e.target.value }))}
                            required
                            placeholder="0.00"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>Annuler</Button>
                        <Button type="submit">Sauvegarder</Button>
                    </div>
                </form>
            </Modal>
        </main>
    );
}
