"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    apiFetch,
    ApiError,
    Category,
    updateCategory,
    deleteCategory,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

function loadCategories() {
    return apiFetch("/categories").then((res) => res as Category[]);
}

export default function CategoriesPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const [cats, setCats] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editType, setEditType] = useState("expense");
    const [editBudget, setEditBudget] = useState("");

    const load = async () => {
        try {
            setErr(null);
            setLoading(true);
            const data = await loadCategories();
            setCats(data);
        } catch (e: any) {
            if (e instanceof ApiError && e.status === 401) {
                router.push("/login");
            } else {
                setErr(e?.message ?? "Erreur");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [router]);

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
        } catch (e: any) {
            addToast(e?.message ?? "Erreur", "error");
        }
    };

    const removeCategory = async (id: number) => {
        if (!confirm("Supprimer cette catégorie ? Toutes ses transactions doivent déjà être supprimées.")) return;
        try {
            await deleteCategory(id);
            addToast("Catégorie supprimée", "success");
            load();
        } catch (e: any) {
            addToast(e?.message ?? "Impossible de supprimer (transactions liées ?)", "error");
        }
    };

    return (
        <main className="max-w-4xl mx-auto space-y-10 pb-16">
            <header className="animate-fade-in-up">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Catégories</h1>
                <p className="text-sm opacity-70 mt-3">
                    Gère tes postes de dépenses et de revenus. Définis des limites de budget mensuelles.
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
                                            Aucune catégorie. Créez-en une depuis l'ajout de transaction.
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
