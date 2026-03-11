"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function BankConnectButton({ onConnectSuccess }: { onConnectSuccess?: () => void }) {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Link Token from our FastAPI backend on mount
    useEffect(() => {
        async function createLinkToken() {
            try {
                const storedToken = localStorage.getItem("token");
                if (!storedToken) return;

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/plaid/create_link_token`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${storedToken}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!response.ok) throw new Error("Failed to create link token");

                const data = await response.json();
                setToken(data.link_token);
            } catch (err: unknown) {
                console.error(err);
                setError("Impossible d&apos;initialiser Plaid.");
            }
        }

        createLinkToken();
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onSuccess = useCallback(async (public_token: string, metadata: any) => {
        setLoading(true);
        setError(null);
        try {
            const storedToken = localStorage.getItem("token");
            
            // Cast institution to a known type to safely access its properties
            const institution = metadata.institution as Record<string, unknown> | undefined;
            const instName = typeof institution?.name === 'string' ? institution.name : "Générique";

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/plaid/exchange_public_token`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${storedToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    public_token,
                    institution_name: instName
                })
            });

            if (!response.ok) throw new Error("Échec lors de l'échange du token public.");

            // Trigger API sync right away now that the connection is made
            await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/plaid/sync_transactions`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${storedToken}` }
            });

            if (onConnectSuccess) {
                onConnectSuccess();
            }
        } catch (err: unknown) {
            console.error(err);
            setError("Erreur lors de la connexion bancaire.");
        } finally {
            setLoading(false);
        }
    }, [onConnectSuccess]);

    const config: Parameters<typeof usePlaidLink>[0] = {
        token,
        onSuccess,
    };

    const { open, ready } = usePlaidLink(config);

    return (
        <div className="flex flex-col items-center">
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <button
                onClick={() => open()}
                disabled={!ready || !token || loading}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-semibold rounded-lg shadow-md hover:from-teal-600 hover:to-emerald-700 disabled:opacity-50 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 flex items-center gap-2"
            >
                <span className="text-xl">🏦</span>
                {loading ? "Connexion en cours..." : "Connecter une Banque"}
            </button>
            {!ready && !error && <p className="text-xs text-gray-500 mt-2 animate-pulse">Initialisation de l&apos;API sécurisée...</p>}
        </div>
    );
}
