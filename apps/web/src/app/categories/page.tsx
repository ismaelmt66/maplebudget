"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    apiFetch,
    ApiError,
    Category,
    updateCategory,
    deleteCategory,
    getBudgetAlerts,
    createBudgetAlert,
    deleteBudgetAlert,
    BudgetAlert,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { money } from "@/lib/format";

function loadCategories() {
    return apiFetch("/categories").then((res) => res as Category[]);
}

export default function CategoriesPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const [cats, setCats] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Budget alerts state
    const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertCatId, setAlertCatId] = useState<number | null>(null);
    const [alertLimit, setAlertLimit] = useState("");

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editType, setEditType] = useState("expense");
    const [editBudget, setEditBudget] = useState("");

    const load = useCallback(async () => {
        try {
            setErr(null);
            setLoading(true);
            const [data, alertsData] = await Promise.all([
                loadCategories(),
                getBudgetAlerts().catch(() => []),
            ]);
            setCats(data);
            setAlerts(alertsData);
        } catch (e: unknown) {
            if (e instanceof ApiError && e.status === 401) {
                router.push("/login");
            } else {
                setErr((e as Error)?.message ?? "Erreur");
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    async function handleCreateAlert() {
        if (!alertCatId || !alertLimit) return;
        try {
            await createBudgetAlert({ category_id: alertCatId, monthly_limit: parseFloat(alertLimit) });
            addToast("Alerte budget créée !", "success");
            setShowAlertModal(false);
            setAlertLimit("");
            setAlertCatId(null);
            load();
        } catch (e: unknown) {
            addToast((e as Error)?.message ?? "Erreur", "error");
        }
    }

    async function handleDeleteAlert(id: number) {
        if (!confirm("Supprimer cette alerte budget ?")) return;
        try {
            await deleteBudgetAlert(id);
            addToast("Alerte supprimée", "success");
            load();
        } catch (e: unknown) {
            addToast((e as Error)?.message ?? "Erreur", "error");
        }
    }

    useEffect(() => {
        load();
    }, [load]);

    const startEdit = (c: Category) => {
        setEditingId(c.id);
        setEditName(c.name);
        setEditType(c.type);
        setEditBudget(c.budget_limit ? c.budget_limit.toString() : "");
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async (c: Category) => {
        try {
            if (!editName.trim()) {
                addToast("Nom requis", "error");
                return;
            }
            const budgetVal = editBudget ? parseFloat(editBudget) : null;
            await updateCategory(c.id, {
                name: editName,
                type: editType,
                budget_limit: budgetVal,
            });
            addToast("Catégorie mise à jour", "success");
            setEditingId(null);
            load();
        } catch (e: unknown) {
            addToast((e as Error)?.message ?? "Erreur", "error");
        }
    };

    const removeCategory = async (id: number) => {
        if (!confirm("Supprimer cette catégorie ? Toutes ses transactions doivent déjà être supprimées.")) return;
        try {
            await deleteCategory(id);
            addToast("Catégorie supprimée", "success");
            load();
        } catch (e: unknown) {
            addToast((e as Error)?.message ?? "Impossible de supprimer (transactions liées ?)", "error");
        }
    };

    return (
        <main className="max-w-4xl mx-auto space-y-10 pb-16">
            <header className="animate-fade-in-up flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Catégories</h1>
                    <p className="text-sm opacity-70 mt-3">
                        Gère tes postes de dépenses et de revenus. Définis des limites de budget mensuelles.
                    </p>
                </div>
                <button
                    onClick={() => setShowAlertModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 hover:bg-orange-500/30 text-orange-300 text-sm font-semibold transition-all shrink-0"
                >
                    + Alerte Budget
                </button>
            </header>

            {/* Modal création alerte */}
            {showAlertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAlertModal(false); }}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowAlertModal(false)} />
                    <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#0f0f10] border border-white/10 shadow-2xl p-6 space-y-5">
                        <h3 className="text-lg font-bold">Nouvelle alerte budget</h3>
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-white/70">
                                Catégorie
                                <select
                                    className="w-full mt-2 bg-black/40 border border-white/10 py-3 px-4 rounded-xl text-sm"
                                    value={alertCatId ?? ""}
                                    onChange={(e) => setAlertCatId(Number(e.target.value))}
                                    aria-label="Catégorie de l'alerte"
                                >
                                    <option value="">Choisir une catégorie...</option>
                                    {cats.filter(c => c.type === "expense").map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-sm font-medium text-white/70">
                                Limite mensuelle ($)
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={alertLimit}
                                    onChange={(e) => setAlertLimit(e.target.value)}
                                    placeholder="ex: 500"
                                    className="w-full mt-2 bg-black/40 border border-white/10 py-3 px-4 rounded-xl text-sm"
                                />
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCreateAlert}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold text-sm transition-all hover:brightness-110"
                            >
                                Créer l&apos;alerte
                            </button>
                            <button
                                onClick={() => setShowAlertModal(false)}
                                className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alertes budget existantes */}
            {alerts.length > 0 && (
                <section className="rounded-3xl bg-orange-500/10 border border-orange-500/20 p-6 animate-fade-in-up">
                    <div className="text-sm font-semibold text-orange-300 mb-4">Alertes Budget Configurées</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {alerts.map((a) => (
                            <div key={a.id} className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-orange-500/10">
                                <div>
                                    <div className="font-semibold text-sm">{a.category_name}</div>
                                    <div className="text-xs opacity-60 mt-0.5">Limite: {money(a.monthly_limit)}/mois</div>
                                </div>
                                <button
                                    onClick={() => handleDeleteAlert(a.id)}
                                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs border border-red-500/20 transition-colors"
                                    title="Supprimer l'alerte"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6 6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {err && (
                <div className="rounded-3xl p-6 relative overflow-hidden backdrop-blur-md animate-fade-in-up delay-100" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", boxShadow: "0 0 30px rgba(239,68,68,0.1)" }}>
                    <div className="font-semibold text-red-100">Erreur</div>
                    <div className="text-sm opacity-80 mt-2 text-red-200">{err}</div>
                </div>
            )}

            {loading ? (
                <div className="text-sm opacity-60 py-12 text-center rounded-3xl bg-black/40 border border-white/5 animate-pulse">
                    Chargement des catégories...
                </div>
            ) : (
                <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 shadow-xl overflow-hidden animate-fade-in-up delay-100">
                    <div className="overflow-x-auto p-4 sm:p-8">
                        <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="px-5 py-4 font-semibold text-white/50 uppercase tracking-wider text-xs">Type</th>
                                    <th className="px-5 py-4 font-semibold text-white/50 uppercase tracking-wider text-xs">Nom</th>
                                    <th className="px-5 py-4 font-semibold text-white/50 uppercase tracking-wider text-xs">Budget max ($)</th>
                                    <th className="px-5 py-4 font-semibold text-white/50 uppercase tracking-wider text-xs w-32">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {cats.map((c) => {
                                    const isEditing = editingId === c.id;

                                    return (
                                        <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <select
                                                        title="Type de catégorie"
                                                        aria-label="Type de catégorie"
                                                        value={editType}
                                                        onChange={(e) => setEditType(e.target.value)}
                                                        className="bg-black/60 border border-white/20 focus:border-blue-500/50 rounded-lg px-3 py-2 text-sm outline-none w-32"
                                                    >
                                                        <option value="expense">Dépense</option>
                                                        <option value="income">Revenu</option>
                                                    </select>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm shadow-sm"
                                                        style={{
                                                            color: c.type === "income" ? "#4ade80" : "#f87171",
                                                            borderColor: c.type === "income" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
                                                            background: c.type === "income" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                                                        }}
                                                    >
                                                        {c.type === "income" ? "Revenu" : "Dépense"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        title="Nom de la catégorie"
                                                        placeholder="Nom de la catégorie"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="bg-black/60 border border-white/20 focus:border-blue-500/50 rounded-lg px-3 py-2 text-sm outline-none w-full"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-white/90 group-hover:text-blue-300 transition-colors">{c.name}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={editBudget}
                                                        onChange={(e) => setEditBudget(e.target.value)}
                                                        placeholder="Ex: 500"
                                                        className="bg-black/60 border border-white/20 focus:border-blue-500/50 rounded-lg px-3 py-2 text-sm outline-none w-28"
                                                    />
                                                ) : (
                                                    <span className="opacity-80 font-mono">{c.budget_limit ? `$${c.budget_limit.toFixed(2)}` : "—"}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                onClick={() => saveEdit(c)}
                                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg text-xs font-medium transition-colors"
                                                            >
                                                                Ok
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                                                            >
                                                                X
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors" onClick={() => startEdit(c)}>
                                                                Éditer
                                                            </button>
                                                            <button className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium border border-red-500/20 transition-colors" onClick={() => removeCategory(c.id)}>
                                                                Sup.
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {cats.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center opacity-60 italic text-sm">
                                            Aucune catégorie. Créez-en une depuis l&apos;ajout de transaction.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </main>
    );
}
