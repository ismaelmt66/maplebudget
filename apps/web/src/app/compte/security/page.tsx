"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function SecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Setup flow
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Disable flow
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/auth/2fa/status") as { enabled: boolean };
      setTwoFAEnabled(data.enabled);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleSetup() {
    try {
      setMsg(null);
      setSetupLoading(true);
      const data = await apiFetch("/auth/2fa/setup", { method: "POST" }) as { secret: string; provisioning_uri: string };
      setSetupSecret(data.secret);
      setSetupUri(data.provisioning_uri);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) router.push("/login");
      else setMsg({ type: "err", text: (e as Error)?.message ?? "Erreur" });
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    try {
      setMsg(null);
      setSetupLoading(true);
      await apiFetch("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      setMsg({ type: "ok", text: "2FA active avec succes !" });
      setTwoFAEnabled(true);
      setSetupSecret(null);
      setSetupUri(null);
      setVerifyCode("");
    } catch (e: unknown) {
      setMsg({ type: "err", text: (e as Error)?.message ?? "Code invalide" });
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    try {
      setMsg(null);
      setDisableLoading(true);
      await apiFetch("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code: disableCode }) });
      setMsg({ type: "ok", text: "2FA desactive." });
      setTwoFAEnabled(false);
      setDisableCode("");
    } catch (e: unknown) {
      setMsg({ type: "err", text: (e as Error)?.message ?? "Code invalide" });
    } finally {
      setDisableLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="mb-container py-10">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="mb-container py-10 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Securite</span>
        </h1>
        <p className="text-white/50 mt-1">Authentification a deux facteurs et protection du compte</p>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl text-sm ${msg.type === "ok" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}>
          {msg.text}
        </div>
      )}

      {/* 2FA Section */}
      <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 md:p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Authentification a Deux Facteurs (2FA)</h2>
            <p className="text-sm text-white/40 mt-1">Ajoutez une couche de securite supplementaire a votre compte</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${twoFAEnabled ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-white/40 border border-white/10"}`}>
            {twoFAEnabled ? "Active" : "Desactive"}
          </div>
        </div>

        {!twoFAEnabled && !setupSecret && (
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              La 2FA protege votre compte avec un code temporaire genere par une application comme Google Authenticator ou Authy.
            </p>
            <Button onClick={handleSetup} disabled={setupLoading}>
              {setupLoading ? "Configuration..." : "Activer la 2FA"}
            </Button>
          </div>
        )}

        {!twoFAEnabled && setupSecret && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-sm font-medium text-white/70 mb-2">Cle secrete</div>
              <div className="font-mono text-sm text-indigo-400 bg-black/40 rounded-xl px-4 py-3 break-all select-all">
                {setupSecret}
              </div>
              <p className="text-xs text-white/30 mt-2">
                Copiez cette cle dans votre application d&apos;authentification, ou utilisez l&apos;URI ci-dessous.
              </p>
            </div>

            {setupUri && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-sm font-medium text-white/70 mb-2">URI de provisionnement</div>
                <div className="font-mono text-xs text-white/40 bg-black/40 rounded-xl px-4 py-3 break-all select-all overflow-x-auto">
                  {setupUri}
                </div>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="text-sm text-white/60 mb-1 block">Code de verification (6 chiffres)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  required
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={setupLoading || verifyCode.length !== 6}>
                  {setupLoading ? "Verification..." : "Verifier et activer"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setSetupSecret(null); setSetupUri(null); }}>
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        )}

        {twoFAEnabled && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <div className="text-sm text-emerald-300">Votre compte est protege par la 2FA.</div>
              </div>
            </div>

            <form onSubmit={handleDisable} className="space-y-4">
              <p className="text-sm text-white/50">Pour desactiver la 2FA, entrez un code depuis votre application.</p>
              <div>
                <label className="text-sm text-white/60 mb-1 block">Code de verification</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, ""))}
                  required
                  placeholder="000000"
                />
              </div>
              <Button type="submit" variant="secondary" disabled={disableLoading || disableCode.length !== 6}>
                {disableLoading ? "Desactivation..." : "Desactiver la 2FA"}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Session Info */}
      <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 max-w-2xl">
        <h2 className="text-lg font-bold mb-4">Session Active</h2>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-white/80">Navigateur Web</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-white/40">Session active</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
