"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function BankConnectButton({ onConnectSuccess }: { onConnectSuccess?: () => void }) {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function createLinkToken() {
            try {
                const authToken = getToken();
                if (!authToken) return;

                const data = await apiFetch("/plaid/create_link_token", { method: "POST" });
                setToken(data.link_token);
            } catch (err: unknown) {
                console.error(err);
                setError("Impossible d'initialiser Plaid.");
            }
        }

        createLinkToken();
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onSuccess = useCallback(async (public_token: string, metadata: any) => {
        setLoading(true);
        setError(null);
        try {
            const institution = metadata.institution as Record<string, unknown> | undefined;
            const instName = typeof institution?.name === 'string' ? institution.name : "Générique";

            await apiFetch("/plaid/exchange_public_token", {
                method: "POST",
                body: JSON.stringify({ public_token, institution_name: instName }),
            });

            await apiFetch("/plaid/sync_transactions", { method: "POST" });

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
        <button
            onClick={() => open()}
            disabled={!ready || !token || loading}
            title={!ready && !error ? "Initialisation de l'API sécurisée..." : undefined}
            className="mb-btn gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #0d9488, #059669)", borderColor: "transparent", boxShadow: "0 4px 20px rgba(16,185,129,0.25)" }}
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            {loading ? "Connexion..." : "Connecter une Banque"}
        </button>
    );
}
