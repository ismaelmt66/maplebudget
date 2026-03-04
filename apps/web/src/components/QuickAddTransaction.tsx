"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { getCategories, createTransaction, Category } from "@/lib/api";

interface QuickAddProps {
    isOpen: boolean;
    onClose: () => void;
    // Optionnel: callback pour rafraîchir les données si on est sur la même page
    onSuccess?: () => void;
}

export default function QuickAddTransaction({ isOpen, onClose, onSuccess }: QuickAddProps) {
    const [cats, setCats] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);

    // States du form
    const [amount, setAmount] = useState<number | "">("");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [note, setNote] = useState("");

    const { addToast } = useToast();

    // Load categories when the modal opens
    useEffect(() => {
        if (isOpen) {
            loadCats();
            // Reset form
            setAmount("");
            setNote("");
            setDate(new Date().toISOString().slice(0, 10));
        }
    }, [isOpen]);

    async function loadCats() {
        try {
            const c = await getCategories();
            setCats(c);
            if (c.length > 0 && categoryId === null) {
                setCategoryId(c[0].id);
            }
        } catch (err) {
            console.error("Failed to load categories for Quick Add", err);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!amount || Number(amount) <= 0 || !categoryId) {
            addToast("Veuillez remplir un montant valide et choisir une catégorie.", "error");
            return;
        }

        setLoading(true);
        try {
            await createTransaction({
                amount: Number(amount),
                date,
                category_id: categoryId,
                note: note.trim()
            });

            addToast("Transaction ajoutée avec succès !", "success");
            onClose();
            if (onSuccess) onSuccess();
        } catch (err: any) {
            addToast(err?.message || "Erreur lors de l'ajout", "error");
        } finally {
            setLoading(false);
        }
    }

    // Diviser les catégories par type pour une meilleure UX
    const incomeCats = cats.filter(c => c.type === "income");
    const expenseCats = cats.filter(c => c.type === "expense");

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajout rapide">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5 opacity-80">Montant</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">$</span>
                        <input
                            type="number"
                            className="mb-input w-full pl-8 font-medium text-lg"
                            placeholder="0.00"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                            autoFocus
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 opacity-80">Date</label>
                        <input
                            type="date"
                            className="mb-input w-full"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 opacity-80">Catégorie</label>
                        <select
                            className="mb-input w-full"
                            value={categoryId ?? ""}
                            onChange={(e) => setCategoryId(Number(e.target.value))}
                            required
                        >
                            <optgroup label="Dépenses">
                                {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="Revenus">
                                {incomeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5 opacity-80">Note (optionnelle)</label>
                    <input
                        type="text"
                        className="mb-input w-full"
                        placeholder="Ex: Épicerie semaine..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={100}
                    />
                </div>

                <div className="mt-4 flex gap-3">
                    <button
                        type="submit"
                        className="mb-btn mb-btn-primary flex-1 py-2.5 text-base"
                        disabled={loading}
                    >
                        {loading ? "Ajout..." : "Enregistrer"}
                    </button>
                    <button
                        type="button"
                        className="mb-btn flex-1 py-2.5 text-base bg-white/5 hover:bg-white/10"
                        onClick={onClose}
                    >
                        Annuler
                    </button>
                </div>
            </form>
        </Modal>
    );
}
