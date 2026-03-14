"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    apiFetch,
    ApiError,
    Category,
    updateCategory,
    deleteCategory,
} from "@/lib/api";
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

    const load = useCallback(async () => {
        try {
            setErr(null);
            setLoading(true);
            const data = await loadCategories();
            setCats(data);
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

    useEffect(() => {
        load();
    }, [load]);

    const startEdit = (c: Category) => {
        setEditingId(c.id);
        setEditName(c.name);
        setEditType(c.type);
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
            await updateCategory(c.id, {
                name: editName,
                type: editType,
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
        <main className="max-w-4xl mx-auto px-4 space-y-6 pb-12">
            <header className="animate-fade-in-up flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Catégories</h1>
                    <p className="text-sm opacity-70 mt-3">
                        Gérez vos postes de dépenses et de revenus.
                    </p>
                </div>
                <Link
                    href="/finances/budget"
                    className="px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-300 text-sm font-semibold transition-all shrink-0 flex items-center gap-2"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Gérer les budgets
                </Link>
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
                                        <td colSpan={3} className="px-5 py-12 text-center opacity-60 italic text-sm">
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
