"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    ApiError, Asset, Category,
    getAssets, createAsset, updateAsset, deleteAsset,
    getCategories,
    AllocationRule, AllocationSimulateResult, ApplyResult,
    getAllocationRules, createAllocationRule, updateAllocationRule, deleteAllocationRule,
    simulateAllocation, applyAllocation,
    getPatrimoineAIAnalysis,
} from "@/lib/api";
import { money } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// ─── Mini Sparkline Component ───────────────────────────────────────────────
function Sparkline({ history, positive }: { history: { date: string; balance: number }[]; positive: boolean }) {
    if (history.length < 2) return <div className="h-8 opacity-30 text-xs flex items-center">Pas d&apos;historique</div>;
    const vals = history.map(h => h.balance);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const W = 120, H = 32;
    const pts = vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * W;
        const y = H - ((v - min) / range) * H;
        return `${x},${y}`;
    });
    const color = positive ? "#34d399" : "#f87171";
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-8" preserveAspectRatio="none">
            <path d={`M ${pts.join(" L ")}`} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        </svg>
    );
}

// ─── Markdown Renderer (reused from coach) ───────────────────────────────────
function RichMarkdown({ text }: { text: string }) {
    const lines = text.split("\n");
    return (
        <div className="text-sm text-white/80 space-y-1 leading-relaxed">
            {lines.map((line, i) => {
                if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200 mt-4 mb-2">{line.slice(3)}</h2>;
                if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-white/90 mt-3">{line.slice(4)}</h3>;
                if (line.startsWith("> [!TIP]")) return <div key={i} className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 text-emerald-300 text-xs font-medium mt-2">💡 Conseil</div>;
                if (line.startsWith("> [!NOTE]")) return <div key={i} className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2 text-blue-300 text-xs font-medium mt-2">📝 Note</div>;
                if (line.startsWith("> [!WARNING]")) return <div key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2 text-yellow-300 text-xs font-medium mt-2">⚠ Attention</div>;
                if (line.startsWith("> ")) return <p key={i} className="opacity-80 pl-3 border-l-2 border-white/20 italic text-xs">{line.slice(2)}</p>;
                if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc leading-relaxed" dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />;
                if (line.startsWith("|")) return <p key={i} className="font-mono text-xs opacity-60">{line}</p>;
                if (line.startsWith("---")) return <hr key={i} className="border-white/10 my-3" />;
                const html = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
                return line.trim() ? <p key={i} dangerouslySetInnerHTML={{ __html: html }} /> : <div key={i} className="h-1" />;
            })}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AssetsPage() {
    const router = useRouter();

    // Data
    const [assets, setAssets] = useState<Asset[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [rules, setRules] = useState<AllocationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // UI state
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"assets" | "rules" | "ai">("assets");

    // Asset form
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [assetForm, setAssetForm] = useState({ name: "", type: "checking", balance: "" });

    // Rule form
    const [ruleForm, setRuleForm] = useState({ name: "", source_type: "all_income", source_category_id: "", target_asset_id: "", allocation_percent: "" });

    // Simulator
    const [simAmount, setSimAmount] = useState("");
    const [simResults, setSimResults] = useState<AllocationSimulateResult[]>([]);
    const [simLoading, setSimLoading] = useState(false);

    // Apply
    const [applyAmount, setApplyAmount] = useState("");
    const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
    const [applying, setApplying] = useState(false);

    // AI analysis
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setErr(null);
            const [a, c, r] = await Promise.all([getAssets(), getCategories(), getAllocationRules()]);
            setAssets(a);
            setCategories(c);
            setRules(r);
        } catch (e: unknown) {
            if (e instanceof ApiError && e.status === 401) router.push("/login");
            else setErr((e as Error).message || "Erreur de chargement");
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { load(); }, [load]);

    // ─── KPIs ────────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const productive = assets.filter(a => a.type !== "liability").reduce((s, a) => s + a.balance, 0);
        const liabilities = assets.filter(a => a.type === "liability").reduce((s, a) => s + a.balance, 0);
        const netWorth = productive - liabilities;
        const types = new Set(assets.filter(a => a.type !== "liability").map(a => a.type));
        const diversityScore = Math.min(types.size * 25, 100);
        return { productive, liabilities, netWorth, diversityScore };
    }, [assets]);

    // ─── Wealth Curve ─────────────────────────────────────────────────────────
    const wealthCurve = useMemo(() => {
        const dateMap: Record<string, number> = {};
        const currentBalances: Record<number, number> = {};
        assets.forEach(a => a.history?.forEach(h => { dateMap[h.date] = 0; }));
        const sortedDates = Object.keys(dateMap).sort();
        return sortedDates.map(date => {
            assets.forEach(a => {
                const entry = a.history?.find(h => h.date === date);
                if (entry) currentBalances[a.id] = a.type !== "liability" ? entry.balance : -entry.balance;
            });
            return { date, value: Object.values(currentBalances).reduce((s, v) => s + v, 0) };
        });
    }, [assets]);

    const wealthPath = useMemo(() => {
        if (wealthCurve.length < 2) return { line: "", area: "" };
        const W = 1000, H = 200;
        const vals = wealthCurve.map(d => d.value);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = max - min || 1;
        const pts = vals.map((v, i) => ({ x: (i / (vals.length - 1)) * W, y: H - ((v - min) / range) * H }));
        const line = pts.reduce((acc, p, i, a) => {
            if (i === 0) return `M ${p.x},${p.y}`;
            const cp1x = a[i - 1].x + (p.x - a[i - 1].x) / 2;
            return `${acc} C ${cp1x},${a[i - 1].y} ${cp1x},${p.y} ${p.x},${p.y}`;
        }, "");
        const area = `${line} L ${pts[pts.length - 1].x},${H} L 0,${H} Z`;
        return { line, area };
    }, [wealthCurve]);

    // ─── Asset Save ───────────────────────────────────────────────────────────
    const handleAssetSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { name: assetForm.name, type: assetForm.type, balance: parseFloat(assetForm.balance) || 0 };
            if (editingAsset) await updateAsset(editingAsset.id, payload);
            else await createAsset(payload);
            setIsAssetModalOpen(false);
            setEditingAsset(null);
            load();
        } catch (e: unknown) { alert((e as Error).message); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer cet actif ?")) return;
        try { await deleteAsset(id); setSelectedAsset(null); load(); } catch (e: unknown) { alert((e as Error).message); }
    };

    // ─── Rule Save ────────────────────────────────────────────────────────────
    const handleRuleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createAllocationRule({
                name: ruleForm.name,
                source_type: ruleForm.source_type,
                source_category_id: ruleForm.source_type === "category" && ruleForm.source_category_id ? parseInt(ruleForm.source_category_id) : null,
                target_asset_id: parseInt(ruleForm.target_asset_id),
                allocation_percent: parseFloat(ruleForm.allocation_percent),
            });
            setIsRuleModalOpen(false);
            setRuleForm({ name: "", source_type: "all_income", source_category_id: "", target_asset_id: "", allocation_percent: "" });
            load();
        } catch (e: unknown) { alert((e as Error).message); }
    };

    // ─── Simulate ─────────────────────────────────────────────────────────────
    const handleSimulate = async () => {
        const amt = parseFloat(simAmount);
        if (!amt) return;
        setSimLoading(true);
        try { setSimResults(await simulateAllocation(amt)); }
        catch (e: unknown) { alert((e as Error).message); }
        finally { setSimLoading(false); }
    };

    // ─── Apply ────────────────────────────────────────────────────────────────
    const handleApply = async () => {
        const amt = parseFloat(applyAmount);
        if (!amt) return;
        setApplying(true);
        try {
            const res = await applyAllocation(amt);
            setApplyResult(res);
            load();
        } catch (e: unknown) { alert((e as Error).message); }
        finally { setApplying(false); }
    };

    // ─── AI Analysis ──────────────────────────────────────────────────────────
    const handleAIAnalysis = async () => {
        setAiLoading(true);
        setAiReport(null);
        try { const res = await getPatrimoineAIAnalysis(); setAiReport(res.report); }
        catch (e: unknown) { setAiReport("Erreur lors de l'analyse."); }
        finally { setAiLoading(false); }
    };

    const typeLabel: Record<string, string> = { checking: "Compte Courant", savings: "Épargne", stock: "Bourse", crypto: "Crypto", liability: "Dette", real_estate: "Immobilier" };
    const typeGradient: Record<string, string> = { checking: "from-blue-500/20 to-blue-900/10 border-blue-500/20", savings: "from-emerald-500/20 to-emerald-900/10 border-emerald-500/20", stock: "from-purple-500/20 to-purple-900/10 border-purple-500/20", crypto: "from-orange-500/20 to-orange-900/10 border-orange-500/20", liability: "from-red-500/20 to-red-900/10 border-red-500/20", real_estate: "from-cyan-500/20 to-cyan-900/10 border-cyan-500/20" };
    const incomeCategories = categories.filter(c => c.type === "income");

    return (
        <main className="max-w-7xl mx-auto space-y-10 pb-16 px-4">

            {/* ── Hero Header ───────────────────────────────── */}
            <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in-up pt-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">Patrimoine</span>
                        <span className="text-xs text-white/40">{assets.length} actif(s)</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">Votre Richesse</h1>
                    <p className="text-sm text-white/50 mt-2">Gérez, automatisez et optimisez votre patrimoine avec l&apos;IA.</p>
                </div>
                <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-white/40 font-bold mb-1">Net Worth</div>
                    <div className={`text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r ${kpis.netWorth >= 0 ? "from-emerald-400 to-teal-200" : "from-red-400 to-rose-200"}`}>
                        {money(kpis.netWorth)}
                    </div>
                </div>
            </section>

            {err && <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm">{err}</div>}

            {/* ── KPI Bar ───────────────────────────────────── */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up delay-100">
                {[
                    { label: "Actifs Productifs", value: money(kpis.productive), color: "text-emerald-400", bg: "from-emerald-500/10 to-transparent border-emerald-500/20" },
                    { label: "Dettes & Emprunts", value: money(kpis.liabilities), color: "text-red-400", bg: "from-red-500/10 to-transparent border-red-500/20" },
                    { label: "Règles Actives", value: `${rules.filter(r => r.is_active).length}`, color: "text-blue-400", bg: "from-blue-500/10 to-transparent border-blue-500/20" },
                    { label: "Diversification", value: `${kpis.diversityScore}/100`, color: "text-purple-400", bg: "from-purple-500/10 to-transparent border-purple-500/20" },
                ].map((k) => (
                    <div key={k.label} className={`rounded-2xl p-5 bg-gradient-to-br ${k.bg} border backdrop-blur-xl`}>
                        <div className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">{k.label}</div>
                        <div className={`text-2xl font-black ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </section>

            {/* ── Wealth Curve ─────────────────────────────── */}
            {wealthCurve.length >= 2 && (
                <section className="rounded-3xl bg-black/40 border border-white/10 p-6 md:p-8 backdrop-blur-xl animate-fade-in-up delay-150">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold">Évolution du Patrimoine</h2>
                        <div className="text-xs text-white/40 font-mono">{wealthCurve[0]?.date} → {wealthCurve[wealthCurve.length - 1]?.date}</div>
                    </div>
                    <div className="h-[200px] w-full">
                        <svg viewBox="0 0 1000 200" className="w-full h-full" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="wgr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(52,211,153,0.35)" />
                                    <stop offset="100%" stopColor="rgba(52,211,153,0)" />
                                </linearGradient>
                                <filter id="glow2">
                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>
                            <path d={wealthPath.area} fill="url(#wgr)" />
                            <path d={wealthPath.line} fill="none" stroke="#34d399" strokeWidth="3" filter="url(#glow2)" strokeLinecap="round" />
                        </svg>
                    </div>
                </section>
            )}

            {/* ── Tabs ─────────────────────────────────────── */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 w-fit">
                {(["assets", "rules", "ai"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === tab ? "bg-white/15 text-white shadow-lg" : "text-white/40 hover:text-white/70"}`}
                    >
                        {tab === "assets" ? "🏦 Actifs" : tab === "rules" ? "⚙️ Automatisation" : "🧠 Analyse IA"}
                    </button>
                ))}
            </div>

            {/* ══════════ TAB: ASSETS ══════════ */}
            {activeTab === "assets" && (
                <section className="animate-fade-in-up">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Comptes & Actifs</h2>
                        <Button onClick={() => { setEditingAsset(null); setAssetForm({ name: "", type: "checking", balance: "" }); setIsAssetModalOpen(true); }}>+ Ajouter</Button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />)}
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="text-center py-20 rounded-3xl bg-white/5 border border-white/10 opacity-70">
                            <div className="text-4xl mb-3">🏦</div>
                            <p>Aucun actif enregistré. Commencez par ajouter votre compte courant !</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assets.map(a => {
                                const lastTwo = (a.history || []).slice(-2);
                                const delta = lastTwo.length === 2 ? a.balance - lastTwo[0].balance : null;
                                const positive = delta === null || delta >= 0;
                                return (
                                    <div
                                        key={a.id}
                                        onClick={() => setSelectedAsset(a)}
                                        className={`group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br ${typeGradient[a.type] || "from-white/10 to-transparent border-white/10"} border backdrop-blur-xl hover:scale-[1.02] hover:brightness-110 transition-all duration-300 shadow-xl cursor-pointer`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="text-xs font-bold uppercase tracking-widest opacity-70">{typeLabel[a.type] || a.type}</div>
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-all"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                            </button>
                                        </div>
                                        <h3 className="text-lg font-bold text-white truncate">{a.name}</h3>
                                        <div className="mt-4 flex items-end justify-between">
                                            <div>
                                                <div className="text-2xl font-black text-white">{money(a.balance)}</div>
                                                {delta !== null && (
                                                    <div className={`text-xs font-semibold mt-1 ${positive ? "text-emerald-400" : "text-red-400"}`}>
                                                        {positive ? "↗" : "↘"} {money(Math.abs(delta))} vs avant
                                                    </div>
                                                )}
                                            </div>
                                            <Sparkline history={a.history || []} positive={positive} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* ══════════ TAB: RULES ══════════ */}
            {activeTab === "rules" && (
                <section className="animate-fade-in-up space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Règles d&apos;Allocation Automatique</h2>
                            <p className="text-sm text-white/50 mt-1">Configurez un pourcentage de vos revenus à diriger automatiquement vers vos actifs.</p>
                        </div>
                        <Button onClick={() => setIsRuleModalOpen(true)}>+ Créer une Règle</Button>
                    </div>

                    {rules.length === 0 ? (
                        <div className="text-center py-16 rounded-3xl bg-white/5 border border-dashed border-white/20">
                            <div className="text-4xl mb-3">⚙️</div>
                            <p className="text-white/50">Aucune règle définie. Exemple : &quot;20% de tous mes revenus → Livret A&quot;</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {rules.map(r => (
                                <div key={r.id} className="flex items-center gap-4 p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${r.is_active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-white/20"}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-white">{r.name}</div>
                                        <div className="text-xs text-white/50 mt-0.5">
                                            {r.source_type === "all_income" ? "Tous revenus" : `Cat: ${r.source_category_name}`}
                                            {" "} → {" "}
                                            <span className="text-emerald-400 font-semibold">{r.target_asset_name}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-white">{r.allocation_percent}%</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateAllocationRule(r.id, { is_active: !r.is_active }).then(() => load())}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${r.is_active ? "border-white/20 text-white/50 hover:bg-white/5" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                                        >
                                            {r.is_active ? "Désactiver" : "Activer"}
                                        </button>
                                        <button
                                            onClick={() => { if (confirm("Supprimer ?")) deleteAllocationRule(r.id).then(() => load()); }}
                                            className="px-3 py-1 rounded-lg text-xs font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                                        >
                                            Suppr.
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Simulator */}
                    <div className="rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-6">
                        <h3 className="text-lg font-bold mb-4">🧮 Simulateur d&apos;Allocation</h3>
                        <div className="flex gap-3 flex-wrap">
                            <Input
                                type="number"
                                placeholder="Montant du revenu (ex: 3000)"
                                value={simAmount}
                                onChange={e => setSimAmount(e.target.value)}
                                className="flex-1 min-w-48"
                            />
                            <Button onClick={handleSimulate} disabled={simLoading}>
                                {simLoading ? "Calcul..." : "Simuler"}
                            </Button>
                        </div>
                        {simResults.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {simResults.map(r => (
                                    <div key={r.rule_id} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div>
                                            <span className="font-semibold text-white">{r.rule_name}</span>
                                            <span className="text-xs text-white/50 ml-2">→ {r.target_asset_name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-emerald-400 font-bold">{money(r.allocated_amount)}</div>
                                            <div className="text-xs text-white/40">{r.percent}%</div>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 border-t border-white/10">
                                    <span className="text-white/60 text-sm">Total alloué</span>
                                    <span className="text-white font-bold">{money(simResults.reduce((s, r) => s + r.allocated_amount, 0))}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Apply Panel */}
                    <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-6">
                        <h3 className="text-lg font-bold mb-2">⚡ Appliquer les Règles Maintenant</h3>
                        <p className="text-sm text-white/50 mb-4">Entrez un montant de revenu et les règles actives mettront à jour les soldes de vos actifs automatiquement.</p>
                        <div className="flex gap-3 flex-wrap">
                            <Input
                                type="number"
                                placeholder="Montant du revenu"
                                value={applyAmount}
                                onChange={e => setApplyAmount(e.target.value)}
                                className="flex-1 min-w-48"
                            />
                            <Button onClick={() => setIsApplyModalOpen(true)}>Appliquer</Button>
                        </div>
                        {applyResult && (
                            <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="font-semibold text-emerald-300 mb-2">✅ {applyResult.count} règle(s) appliquée(s) — {money(applyResult.total_allocated)} distribués</div>
                                {applyResult.applied.map((a, i) => (
                                    <div key={i} className="text-xs text-white/60 flex justify-between">
                                        <span>{a.rule_name} → {a.asset_name}</span>
                                        <span className="text-emerald-400">+{money(a.allocated_amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ══════════ TAB: AI ══════════ */}
            {activeTab === "ai" && (
                <section className="animate-fade-in-up space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Analyse IA de votre Patrimoine</h2>
                            <p className="text-sm text-white/50 mt-1">Score de santé, fonds d&apos;urgence, diversification, et recommandations personnalisées.</p>
                        </div>
                        <Button onClick={handleAIAnalysis} disabled={aiLoading}>
                            {aiLoading ? "Analyse en cours..." : "🧠 Analyser mon Patrimoine"}
                        </Button>
                    </div>

                    {aiLoading && (
                        <div className="rounded-3xl bg-black/40 border border-emerald-500/20 p-8 flex items-center gap-4">
                            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-white/60">Le moteur IA analyse votre portefeuille...</span>
                        </div>
                    )}

                    {aiReport && (
                        <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 md:p-8">
                            <RichMarkdown text={aiReport} />
                        </div>
                    )}

                    {!aiReport && !aiLoading && (
                        <div className="text-center py-20 rounded-3xl bg-white/5 border border-dashed border-white/20">
                            <div className="text-5xl mb-4">🧠</div>
                            <p className="text-white/50">Cliquez sur &quot;Analyser mon Patrimoine&quot; pour obtenir un rapport complet.</p>
                        </div>
                    )}
                </section>
            )}

            {/* ── Asset Detail Modal ───────────────────────── */}
            {selectedAsset && (
                <Modal isOpen={!!selectedAsset} onClose={() => setSelectedAsset(null)} title={selectedAsset.name}>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs uppercase tracking-widest text-white/40">{typeLabel[selectedAsset.type] || selectedAsset.type}</span>
                            <span className={`text-2xl font-black ${selectedAsset.type === "liability" ? "text-red-400" : "text-emerald-400"}`}>{money(selectedAsset.balance)}</span>
                        </div>
                        {(selectedAsset.history || []).length >= 2 && (
                            <div>
                                <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Historique récent</div>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {[...(selectedAsset.history || [])].reverse().map((h, i) => (
                                        <div key={i} className="flex justify-between text-sm p-2 rounded-lg bg-white/5">
                                            <span className="text-white/50">{h.date}</span>
                                            <span className="font-semibold">{money(h.balance)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 pt-2">
                            <Button onClick={() => { setEditingAsset(selectedAsset); setAssetForm({ name: selectedAsset.name, type: selectedAsset.type, balance: selectedAsset.balance.toString() }); setSelectedAsset(null); setIsAssetModalOpen(true); }}>Modifier</Button>
                            <Button variant="secondary" onClick={() => setSelectedAsset(null)}>Fermer</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Add/Edit Asset Modal ─────────────────────── */}
            <Modal isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)} title={editingAsset ? "Modifier l'actif" : "Nouvel Actif"}>
                <form onSubmit={handleAssetSave} className="space-y-4">
                    <div><label className="text-sm text-white/60 mb-1 block">Nom</label>
                        <Input value={assetForm.name} onChange={e => setAssetForm(p => ({ ...p, name: e.target.value }))} required placeholder="Ex: Livret A" />
                    </div>
                    <div><label className="text-sm text-white/60 mb-1 block">Type</label>
                        <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={assetForm.type} onChange={e => setAssetForm(p => ({ ...p, type: e.target.value }))}>
                            <option value="checking">Compte Courant</option>
                            <option value="savings">Épargne</option>
                            <option value="stock">Bourse / Placements</option>
                            <option value="crypto">Crypto-monnaies</option>
                            <option value="real_estate">Immobilier</option>
                            <option value="liability">Dette / Emprunt</option>
                        </select>
                    </div>
                    <div><label className="text-sm text-white/60 mb-1 block">Solde</label>
                        <Input type="number" step="0.01" value={assetForm.balance} onChange={e => setAssetForm(p => ({ ...p, balance: e.target.value }))} required placeholder="0.00" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setIsAssetModalOpen(false)}>Annuler</Button>
                        <Button type="submit">Sauvegarder</Button>
                    </div>
                </form>
            </Modal>

            {/* ── Create Rule Modal ────────────────────────── */}
            <Modal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} title="Nouvelle Règle d'Allocation">
                <form onSubmit={handleRuleSave} className="space-y-4">
                    <div><label className="text-sm text-white/60 mb-1 block">Nom de la règle</label>
                        <Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} required placeholder="Ex: Épargne mensuelle automatique" />
                    </div>
                    <div><label className="text-sm text-white/60 mb-1 block">Source de revenus</label>
                        <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={ruleForm.source_type} onChange={e => setRuleForm(p => ({ ...p, source_type: e.target.value }))}>
                            <option value="all_income">Tous les revenus</option>
                            <option value="category">Catégorie spécifique</option>
                        </select>
                    </div>
                    {ruleForm.source_type === "category" && (
                        <div><label className="text-sm text-white/60 mb-1 block">Catégorie source</label>
                            <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={ruleForm.source_category_id} onChange={e => setRuleForm(p => ({ ...p, source_category_id: e.target.value }))} required>
                                <option value="">-- Choisir --</option>
                                {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div><label className="text-sm text-white/60 mb-1 block">Actif cible</label>
                        <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={ruleForm.target_asset_id} onChange={e => setRuleForm(p => ({ ...p, target_asset_id: e.target.value }))} required>
                            <option value="">-- Choisir un actif --</option>
                            {assets.filter(a => a.type !== "liability").map(a => <option key={a.id} value={a.id}>{a.name} ({money(a.balance)})</option>)}
                        </select>
                    </div>
                    <div><label className="text-sm text-white/60 mb-1 block">Pourcentage à allouer (%)</label>
                        <Input type="number" min="0.1" max="100" step="0.1" value={ruleForm.allocation_percent} onChange={e => setRuleForm(p => ({ ...p, allocation_percent: e.target.value }))} required placeholder="Ex: 20" />
                    </div>
                    {ruleForm.allocation_percent && ruleForm.target_asset_id && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                            💡 Pour <strong>3 000 $</strong> de revenus → <strong>{money(3000 * parseFloat(ruleForm.allocation_percent || "0") / 100)}</strong> iront vers {assets.find(a => a.id === parseInt(ruleForm.target_asset_id))?.name || "l&apos;actif sélectionné"}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setIsRuleModalOpen(false)}>Annuler</Button>
                        <Button type="submit">Créer la Règle</Button>
                    </div>
                </form>
            </Modal>

            {/* ── Apply Confirm Modal ──────────────────────── */}
            <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Confirmer l'Application">
                <div className="space-y-4">
                    <p className="text-white/70">Vous êtes sur le point d&apos;appliquer toutes les règles actives à un revenu de <strong className="text-white">{money(parseFloat(applyAmount) || 0)}</strong>. Les soldes de vos actifs seront mis à jour.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsApplyModalOpen(false)}>Annuler</Button>
                        <Button onClick={async () => { setIsApplyModalOpen(false); await handleApply(); }} disabled={applying}>
                            {applying ? "Application..." : "Confirmer"}
                        </Button>
                    </div>
                </div>
            </Modal>

        </main>
    );
}
