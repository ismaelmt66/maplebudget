"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function RichMarkdown({ text }: { text: string }) {
    const lines = text.split("\n");

    interface LineBlock { kind: "line"; content: string }
    interface TableBlock { kind: "table"; rows: string[][] }
    type Block = LineBlock | TableBlock;

    const blocks: Block[] = [];
    let i = 0;
    while (i < lines.length) {
        if (lines[i].startsWith("|")) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].startsWith("|")) { tableLines.push(lines[i]); i++; }
            const isSep = (l: string) => l.split("|").slice(1, -1).every(c => /^[\s\-:]+$/.test(c));
            const rows = tableLines
                .filter(l => !isSep(l))
                .map(l => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim()));
            if (rows.length > 0) blocks.push({ kind: "table", rows });
        } else {
            blocks.push({ kind: "line", content: lines[i] });
            i++;
        }
    }

    const bold = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');

    const renderLine = (line: string, key: number) => {
        if (line.startsWith("## ")) return <h2 key={key} className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200 mt-4 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={key} className="text-base font-semibold text-white/90 mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("> [!TIP]")) return <div key={key} className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 text-emerald-300 text-xs font-medium mt-2">💡 Conseil</div>;
        if (line.startsWith("> [!NOTE]")) return <div key={key} className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2 text-blue-300 text-xs font-medium mt-2">📝 Note</div>;
        if (line.startsWith("> [!WARNING]")) return <div key={key} className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2 text-yellow-300 text-xs font-medium mt-2">⚠️ Attention</div>;
        if (line.startsWith("> ")) return <p key={key} className="opacity-80 pl-3 border-l-2 border-white/20 italic text-xs">{line.slice(2)}</p>;
        if (line.startsWith("- ")) return <li key={key} className="ml-4 list-disc leading-relaxed" dangerouslySetInnerHTML={{ __html: bold(line.slice(2)) }} />;
        if (line.startsWith("---")) return <hr key={key} className="border-white/10 my-3" />;
        return line.trim() ? <p key={key} dangerouslySetInnerHTML={{ __html: bold(line) }} /> : <div key={key} className="h-1" />;
    };

    return (
        <div className="text-sm text-white/80 space-y-1 leading-relaxed">
            {blocks.map((block, idx) => {
                if (block.kind === "table") {
                    return (
                        <div key={idx} className="overflow-x-auto my-3 rounded-xl border border-white/10">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        {block.rows[0]?.map((cell, j) => (
                                            <th key={j} className="text-left px-3 py-2 text-white/70 font-semibold bg-white/5 whitespace-nowrap"
                                                dangerouslySetInnerHTML={{ __html: bold(cell) }} />
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {block.rows.slice(1).map((row, ri) => (
                                        <tr key={ri} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            {row.map((cell, ci) => (
                                                <td key={ci} className="px-3 py-2 text-white/70 whitespace-nowrap"
                                                    dangerouslySetInnerHTML={{ __html: bold(cell) }} />
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }
                return renderLine(block.content, idx);
            })}
        </div>
    );
}

// ─── Interactive Wealth Chart ─────────────────────────────────────────────────
function InteractiveWealthChart({ data }: { data: { date: string; value: number }[] }) {
    const [range, setRange] = useState<"all" | "6m" | "1y" | "3y">("all");
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [mx, setMx] = useState(0);
    const [my, setMy] = useState(0);
    const [wrapWidth, setWrapWidth] = useState(300);
    const wrapRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<number | null>(null);

    const filtered = useMemo(() => {
        if (range === "all" || data.length === 0) return data;
        const now = new Date();
        const months = range === "6m" ? 6 : range === "1y" ? 12 : 36;
        const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const result = data.filter(d => d.date >= cutoffStr);
        return result.length >= 2 ? result : data;
    }, [data, range]);

    const isPositive = filtered.length >= 2 ? filtered[filtered.length - 1].value >= filtered[0].value : true;
    const theme = isPositive
        ? { s: "rgba(52,211,153,0.90)", a1: "rgba(52,211,153,0.22)" }
        : { s: "rgba(248,113,113,0.90)", a1: "rgba(248,113,113,0.22)" };

    const chartData = useMemo(() => {
        if (filtered.length < 2) return null;
        const W = 1000, H = 300, PAD_L = 54, PAD_R = 24, PAD_T = 26, PAD_B = 38;
        const values = filtered.map(p => p.value);
        let min = Math.min(...values);
        let max = Math.max(...values);
        if (min === max) { min -= 100; max += 100; }
        const span = max - min || 1;
        const pad = span * 0.12;
        min -= pad; max += pad;
        const realSpan = max - min;
        const xStep = (W - PAD_L - PAD_R) / (values.length - 1);

        const pts = values.map((v, i) => {
            const x = PAD_L + i * xStep;
            const y = PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / realSpan);
            return { x, y, v, date: filtered[i].date };
        });

        const line = pts.reduce((acc, p, i, a) => {
            if (i === 0) return `M ${p.x},${p.y}`;
            const prev = a[i - 1];
            const cp1x = prev.x + (p.x - prev.x) / 2;
            return `${acc} C ${cp1x},${prev.y} ${cp1x},${p.y} ${p.x},${p.y}`;
        }, "");

        const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;
        const y0 = Math.min(Math.max(PAD_T + (H - PAD_T - PAD_B) * (1 - (0 - min) / realSpan), PAD_T), H - PAD_B);

        const ticks = Array.from({ length: 5 }, (_, i) => {
            const t = i / 4;
            const v = max - t * (max - min);
            const y = PAD_T + (H - PAD_T - PAD_B) * t;
            return { v, y };
        });

        const vTicks = Array.from({ length: 5 }, (_, i) => {
            const idx = Math.floor(i * (pts.length - 1) / 4);
            return pts[idx];
        });

        return { W, H, PAD_L, PAD_R, PAD_T, PAD_B, pts, min, max, line, area, ticks, y0, vTicks };
    }, [filtered]);

    function clearHideTimer() {
        if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null; }
    }

    function scheduleHide() {
        clearHideTimer();
        hideTimer.current = window.setTimeout(() => setHoverIdx(null), 160);
    }

    function onMove(e: React.MouseEvent<SVGSVGElement>) {
        if (!chartData) return;
        clearHideTimer();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const vx = (x / rect.width) * chartData.W;
        if (vx < chartData.PAD_L - 6 || vx > chartData.W - chartData.PAD_R + 6) {
            scheduleHide(); return;
        }
        let best = 0, bestDist = Infinity;
        for (let i = 0; i < chartData.pts.length; i++) {
            const dx = Math.abs(chartData.pts[i].x - vx);
            if (dx < bestDist) { bestDist = dx; best = i; }
        }
        setHoverIdx(best); setMx(x); setMy(y);
        if (wrapRef.current) setWrapWidth(wrapRef.current.clientWidth);
    }

    if (!chartData) return <div className="text-sm opacity-70 p-6 flex justify-center h-[300px] items-center">Pas assez de données pour afficher le graphique.</div>;

    const hi = hoverIdx !== null ? chartData.pts[hoverIdx] : null;

    const fmtY = (v: number) => {
        if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
        return v.toFixed(0);
    };

    const fmtTick = (d: string) => {
        try { return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }); }
        catch { return d; }
    };

    return (
        <div className="relative isolate">
            <div className="flex justify-end gap-1 mb-2 z-10 relative">
                {(["all", "3y", "1y", "6m"] as const).map(r => (
                    <button key={r} onClick={() => setRange(r)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${range === r ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-white/40 hover:text-white/70"}`}>
                        {r === "all" ? "Tout" : r === "3y" ? "3A" : r === "1y" ? "1A" : "6M"}
                    </button>
                ))}
            </div>

            <div className="relative h-[250px] md:h-[300px] w-full" ref={wrapRef}>
                <svg viewBox={`0 0 ${chartData.W} ${chartData.H}`} className="w-full h-full absolute inset-0 drop-shadow-2xl" preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={scheduleHide}>
                    <defs>
                        <linearGradient id="fillAreaAssets" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={theme.s} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={theme.s} stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="lineGradAssets" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor={theme.s} stopOpacity="0.8" />
                            <stop offset="50%" stopColor={theme.s} stopOpacity="1" />
                            <stop offset="100%" stopColor={theme.s} stopOpacity="0.8" />
                        </linearGradient>
                        <filter id="neonGlowAssets" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    <line x1={chartData.PAD_L} y1={chartData.y0} x2={chartData.W - chartData.PAD_R} y2={chartData.y0} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />

                    {chartData.ticks.map((t, i) => (
                        <g key={`y-${i}`}>
                            <line x1={chartData.PAD_L} y1={t.y} x2={chartData.W - chartData.PAD_R} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                            <text x={chartData.PAD_L - 10} y={t.y + 4} textAnchor="end" fontSize="11" fontWeight="500" fill="rgba(255,255,255,0.35)">
                                {fmtY(t.v)}
                            </text>
                        </g>
                    ))}

                    {chartData.vTicks.map((t, i) => (
                        <text key={`x-${i}`} x={t.x} y={chartData.H - 10} textAnchor="middle" fontSize="10" fontWeight="500" fill="rgba(255,255,255,0.35)">
                            {fmtTick(t.date)}
                        </text>
                    ))}

                    <path d={chartData.area} fill="url(#fillAreaAssets)" className="transition-all duration-300" />
                    <path d={chartData.line} fill="none" stroke="url(#lineGradAssets)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#neonGlowAssets)" className="transition-all duration-300" />

                    {hi && (
                        <g className="transition-all duration-75 ease-out" style={{ transform: `translate(${hi.x}px, ${hi.y}px)`, transformOrigin: "0 0" }}>
                            <line x1="0" y1={-hi.y + chartData.PAD_T} x2="0" y2={chartData.H - chartData.PAD_B - hi.y} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
                            <circle cx="0" cy="0" r="6" fill="#111" stroke={theme.s} strokeWidth="2.5" filter="url(#neonGlowAssets)" />
                        </g>
                    )}
                </svg>

                {hi && (
                    <div
                        className="pointer-events-none absolute z-20 backdrop-blur-xl bg-black/80 border border-white/10 rounded-2xl p-4 shadow-2xl transition-all duration-75 ease-out"
                        style={{
                            left: Math.min(mx + 20, Math.max(wrapWidth - 200, 20)),
                            top: Math.max(10, my - 60),
                            minWidth: "160px"
                        }}
                    >
                        <div className="text-white/50 text-xs font-semibold tracking-wider uppercase mb-1">
                            {new Date(hi.date + "T00:00:00").toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                        </div>
                        <div className="text-2xl font-bold tracking-tight text-white mb-1">
                            {money(hi.v)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.s }}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.s }} />
                            Patrimoine Net
                        </div>
                    </div>
                )}
            </div>
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
    const aiLoadedRef = useRef(false);

    const loadAIAnalysis = useCallback(async () => {
        if (aiLoading) return;
        setAiLoading(true);
        setAiReport(null);
        try {
            const res = await getPatrimoineAIAnalysis();
            setAiReport(res.report);
            aiLoadedRef.current = true;
        } catch {
            setAiReport("Erreur lors de l'analyse. Vérifiez votre connexion et réessayez.");
        } finally {
            setAiLoading(false);
        }
    }, [aiLoading]);

    const load = useCallback(async (triggerAI = false) => {
        try {
            setLoading(true);
            setErr(null);
            const [a, c, r] = await Promise.all([getAssets(), getCategories(), getAllocationRules()]);
            setAssets(a);
            setCategories(c);
            setRules(r);
            // Re-trigger AI if data changed and we've already loaded it once
            if (triggerAI && aiLoadedRef.current) {
                loadAIAnalysis();
            }
        } catch (e: unknown) {
            if (e instanceof ApiError && e.status === 401) router.push("/login");
            else setErr((e as Error).message || "Erreur de chargement");
        } finally {
            setLoading(false);
        }
    }, [router, loadAIAnalysis]);

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

    // ─── Asset Save ───────────────────────────────────────────────────────────
    const handleAssetSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { name: assetForm.name, type: assetForm.type, balance: parseFloat(assetForm.balance) || 0 };
            if (editingAsset) await updateAsset(editingAsset.id, payload);
            else await createAsset(payload);
            setIsAssetModalOpen(false);
            setEditingAsset(null);
            load(true);
        } catch (e: unknown) { alert((e as Error).message); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer cet actif ?")) return;
        try { await deleteAsset(id); setSelectedAsset(null); load(true); } catch (e: unknown) { alert((e as Error).message); }
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
    const handleAIAnalysis = loadAIAnalysis;

    // The backend now uses a cache that is invalidated on data changes,
    // so we no longer need the complex frontend fingerprint to trigger re-analysis.
    // The analysis will be triggered once when the tab is opened, and the backend
    // will provide a fresh report if the data has changed.

    const typeLabel: Record<string, string> = { checking: "Compte Courant", savings: "Épargne", stock: "Bourse", crypto: "Crypto", liability: "Dette", real_estate: "Immobilier" };
    const typeGradient: Record<string, string> = { checking: "from-blue-500/20 to-blue-900/10 border-blue-500/20", savings: "from-emerald-500/20 to-emerald-900/10 border-emerald-500/20", stock: "from-purple-500/20 to-purple-900/10 border-purple-500/20", crypto: "from-orange-500/20 to-orange-900/10 border-orange-500/20", liability: "from-red-500/20 to-red-900/10 border-red-500/20", real_estate: "from-cyan-500/20 to-cyan-900/10 border-cyan-500/20" };
    const incomeCategories = categories.filter(c => c.type === "income");

    return (
        <main suppressHydrationWarning className="max-w-7xl mx-auto space-y-6 pb-12 px-4">

            {/* ── Hero Header ───────────────────────────────── */}
            <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in-up pt-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">Patrimoine</span>
                        <span className="text-xs text-white/40">{assets.length} actif(s)</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Votre Richesse</h1>
                    <p className="text-sm text-white/50 mt-2">Gérez, automatisez et optimisez votre patrimoine avec l&apos;IA.</p>
                </div>
                <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-white/40 font-bold mb-1">Net Worth</div>
                    <div className={`text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${kpis.netWorth >= 0 ? "from-emerald-400 to-teal-200" : "from-red-400 to-rose-200"}`}>
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
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold">Évolution du Patrimoine</h2>
                        <div className="text-xs text-white/40 font-mono">{wealthCurve.length} points</div>
                    </div>
                    <InteractiveWealthChart data={wealthCurve} />
                </section>
            )}

            {/* ── Tabs ─────────────────────────────────────── */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 w-fit">
                {(["assets", "rules", "ai"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => {
                            setActiveTab(tab);
                            // Auto-trigger AI analysis on first visit to the AI tab
                            if (tab === "ai" && !aiReport && !aiLoading) {
                                loadAIAnalysis();
                            }
                        }}
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
                                                type="button"
                                                title="Supprimer cet actif"
                                                onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-all"
                                                aria-label="Supprimer cet actif"
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
                        <button
                            onClick={handleAIAnalysis}
                            disabled={aiLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                        >
                            {aiLoading ? (
                                <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            )}
                            {aiLoading ? "Analyse..." : "Actualiser"}
                        </button>
                    </div>

                    {aiLoading && (
                        <div className="rounded-3xl bg-black/40 border border-emerald-500/20 p-8 flex items-center gap-4">
                            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
                            <div>
                                <div className="text-white/80 font-medium">Analyse en cours...</div>
                                <div className="text-white/40 text-sm mt-0.5">Le moteur IA analyse votre portefeuille, projections et recommandations.</div>
                            </div>
                        </div>
                    )}

                    {aiReport && !aiLoading && (
                        <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 md:p-8">
                            <RichMarkdown text={aiReport} />
                        </div>
                    )}

                    {!aiReport && !aiLoading && (
                        <div className="text-center py-20 rounded-3xl bg-white/5 border border-dashed border-white/20">
                            <div className="text-5xl mb-4">🧠</div>
                            <p className="text-white/50">L&apos;analyse se déclenche automatiquement. Ajoutez des actifs pour obtenir un rapport complet.</p>
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
                        <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={assetForm.type} onChange={e => setAssetForm(p => ({ ...p, type: e.target.value }))} aria-label="Type d'actif">
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
                        <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={ruleForm.source_type} onChange={e => setRuleForm(p => ({ ...p, source_type: e.target.value }))} aria-label="Source de revenus">
                            <option value="all_income">Tous les revenus</option>
                            <option value="category">Catégorie spécifique</option>
                        </select>
                    </div>
                    {ruleForm.source_type === "category" && (
                        <div><label className="text-sm text-white/60 mb-1 block">Catégorie source</label>
                            <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={ruleForm.source_category_id} onChange={e => setRuleForm(p => ({ ...p, source_category_id: e.target.value }))} required aria-label="Catégorie source">
                                <option value="">-- Choisir --</option>
                                {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div><label className="text-sm text-white/60 mb-1 block">Actif cible</label>
                        <select className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all" value={ruleForm.target_asset_id} onChange={e => setRuleForm(p => ({ ...p, target_asset_id: e.target.value }))} required aria-label="Actif cible">
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
