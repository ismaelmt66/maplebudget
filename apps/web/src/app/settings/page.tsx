"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type AuditLog = { id: number; action: string; details?: string; created_at: string };
type TwoFAStatus = { enabled: boolean };
type SetupData = { secret: string; provisioning_uri: string; qr_data: string };

const actionLabels: Record<string, { label: string; icon: string; color: string }> = {
  login:       { label: "Connexion",      icon: "🔑", color: "text-indigo-400" },
  "2fa_enable":  { label: "2FA activé",  icon: "🛡️", color: "text-emerald-400" },
  "2fa_disable": { label: "2FA désactivé",icon: "⚠️", color: "text-orange-400" },
  tx_create:   { label: "Transaction ajoutée", icon: "💳", color: "text-blue-400" },
  tx_delete:   { label: "Transaction supprimée", icon: "🗑️", color: "text-red-400" },
};

export default function SettingsPage() {
  const [tab, setTab] = useState<"security" | "account">("security");
  const [twofa, setTwofa] = useState<TwoFAStatus | null>(null);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading2fa, setLoading2fa] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    apiFetch("/auth/2fa/status").then(d => setTwofa(d as TwoFAStatus)).catch(() => {});
    apiFetch("/audit-logs").then(d => setAuditLogs(d as AuditLog[])).catch(() => {});
  }, []);

  async function startSetup() {
    setLoading2fa(true);
    try {
      const data = await apiFetch("/auth/2fa/setup", { method: "POST" }) as SetupData;
      setSetup(data);
    } catch { addToast("Erreur lors de l'initialisation du 2FA", "error"); }
    finally { setLoading2fa(false); }
  }

  async function verifyAndEnable() {
    try {
      await apiFetch("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      setTwofa({ enabled: true });
      setSetup(null);
      setVerifyCode("");
      addToast("✅ 2FA activé avec succès !", "success");
      apiFetch("/audit-logs").then(d => setAuditLogs(d as AuditLog[])).catch(() => {});
    } catch { addToast("Code invalide ou expiré. Réessaie.", "error"); }
  }

  async function disable2fa() {
    try {
      await apiFetch("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code: disableCode }) });
      setTwofa({ enabled: false });
      setDisableCode("");
      addToast("2FA désactivé.", "info");
    } catch { addToast("Code invalide.", "error"); }
  }

  return (
    <main className="animate-fade-in-up max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">
          Paramètres <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">& Sécurité</span>
        </h1>
        <p className="text-white/50 mt-1 text-sm">Gérez votre compte et la sécurité de votre espace NexLedger.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(["security", "account"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-all ${tab === t ? "text-white bg-white/10 border-b-2 border-violet-400" : "text-white/40 hover:text-white/70"}`}>
            {t === "security" ? "🛡️ Sécurité" : "👤 Compte"}
          </button>
        ))}
      </div>

      {tab === "security" && (
        <div className="space-y-5">
          {/* 2FA Card */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  🔐 Authentification à deux facteurs
                  {twofa?.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Activé</span>
                  )}
                </h2>
                <p className="text-sm text-white/50 mt-1">Protège ton compte avec une application comme Google Authenticator ou Authy.</p>
              </div>
            </div>

            {!twofa?.enabled && !setup && (
              <button onClick={startSetup} disabled={loading2fa}
                className="px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(139,92,246,0.4)] disabled:opacity-50">
                {loading2fa ? "Génération..." : "Activer le 2FA"}
              </button>
            )}

            {setup && !twofa?.enabled && (
              <div className="space-y-4 mt-2">
                <div className="flex gap-6 items-start">
                  {/* QR Code */}
                  <div className="bg-white p-2 rounded-xl flex-shrink-0">
                    <img src={setup.qr_data} alt="QR Code 2FA" width={140} height={140} />
                  </div>
                  <div className="space-y-3 flex-1">
                    <p className="text-sm text-white/70">Scanne ce QR code avec ton application d'authentification, puis entre le code à 6 chiffres.</p>
                    <div className="bg-black/40 rounded-xl p-3 font-mono text-xs text-white/60 break-all">
                      {setup.secret}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text" maxLength={6} placeholder="Code à 6 chiffres"
                        value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={e => e.key === "Enter" && verifyAndEnable()}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 tracking-widest text-center text-lg"
                      />
                      <button onClick={verifyAndEnable}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all">
                        Vérifier
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {twofa?.enabled && (
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  ✅ Le 2FA est actif. Ton compte est protégé.
                </div>
                <div className="flex gap-2 items-center mt-3">
                  <input
                    type="text" maxLength={6} placeholder="Code pour désactiver"
                    value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    className="w-40 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 text-center tracking-widest"
                  />
                  <button onClick={disable2fa}
                    className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-all">
                    Désactiver
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Journal d'audit */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4">📋 Journal d'activité</h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-white/40">Aucune activité enregistrée.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auditLogs.map(log => {
                  const meta = actionLabels[log.action] ?? { label: log.action, icon: "📌", color: "text-white/60" };
                  return (
                    <div key={log.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                      <span className="text-base">{meta.icon}</span>
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                        {log.details && <span className="text-xs text-white/30 ml-2">{log.details}</span>}
                      </div>
                      <span className="text-xs text-white/30">{log.created_at.slice(0, 16).replace("T", " ")}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "account" && (
        <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white">👤 Informations du compte</h2>
          <p className="text-sm text-white/50">La modification du mot de passe et de l'email sera disponible prochainement.</p>
          <div className="bg-white/5 rounded-xl p-4 text-sm text-white/70">
            Pour toute demande de suppression de compte, contactez le support.
          </div>
        </div>
      )}
    </main>
  );
}
