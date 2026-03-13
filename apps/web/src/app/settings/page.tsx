"use client";

import { useEffect, useState } from "react";
import { apiFetch, downloadTransactionsCSV } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type AuditLog = { id: number; action: string; details?: string; created_at: string };
type TwoFAStatus = { enabled: boolean };
type SetupData = { secret: string; provisioning_uri: string; qr_data: string };
type UserInfo = { id: number; email: string };

type Tab = "profile" | "security" | "preferences" | "data";

const actionLabels: Record<string, { label: string; icon: string; color: string }> = {
  login:           { label: "Connexion",           icon: "🔑", color: "text-indigo-400" },
  "2fa_enable":    { label: "2FA activé",           icon: "🛡️", color: "text-emerald-400" },
  "2fa_disable":   { label: "2FA désactivé",        icon: "⚠️", color: "text-orange-400" },
  tx_create:       { label: "Transaction ajoutée",  icon: "💳", color: "text-blue-400" },
  tx_delete:       { label: "Transaction supprimée",icon: "🗑️", color: "text-red-400" },
  password_change: { label: "Mot de passe modifié", icon: "🔐", color: "text-violet-400" },
};

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "profile",     label: "Profil",       icon: "👤" },
  { id: "security",    label: "Sécurité",     icon: "🛡️" },
  { id: "preferences", label: "Préférences",  icon: "⚙️" },
  { id: "data",        label: "Données",      icon: "📦" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [user, setUser] = useState<UserInfo | null>(null);

  // Security state
  const [twofa, setTwofa] = useState<TwoFAStatus | null>(null);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading2fa, setLoading2fa] = useState(false);

  // Password change
  const [pwForm, setPwForm] = useState({ old: "", new: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  // Preferences (localStorage)
  const [currency, setCurrency] = useState("CAD");
  const [theme, setTheme] = useState("dark");

  // Data export
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const { addToast } = useToast();

  useEffect(() => {
    apiFetch("/auth/me").then(d => setUser(d as UserInfo)).catch(() => {});
    apiFetch("/auth/2fa/status").then(d => setTwofa(d as TwoFAStatus)).catch(() => {});
    apiFetch("/audit-logs").then(d => setAuditLogs(d as AuditLog[])).catch(() => {});

    // Load preferences from localStorage
    const savedCurrency = localStorage.getItem("nexledger_currency") || "CAD";
    const savedTheme    = localStorage.getItem("nexledger_theme") || "dark";
    setCurrency(savedCurrency);
    setTheme(savedTheme);
  }, []);

  /* ── 2FA ── */
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
      addToast("2FA activé avec succès !", "success");
      apiFetch("/audit-logs").then(d => setAuditLogs(d as AuditLog[])).catch(() => {});
    } catch { addToast("Code invalide ou expiré.", "error"); }
  }

  async function disable2fa() {
    try {
      await apiFetch("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code: disableCode }) });
      setTwofa({ enabled: false });
      setDisableCode("");
      addToast("2FA désactivé.", "info");
    } catch { addToast("Code invalide.", "error"); }
  }

  /* ── Password ── */
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.new !== pwForm.confirm) {
      addToast("Les nouveaux mots de passe ne correspondent pas.", "error");
      return;
    }
    if (pwForm.new.length < 8) {
      addToast("Le nouveau mot de passe doit faire au moins 8 caractères.", "error");
      return;
    }
    setPwLoading(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password: pwForm.old, new_password: pwForm.new }),
      });
      setPwForm({ old: "", new: "", confirm: "" });
      addToast("Mot de passe modifié avec succès.", "success");
      apiFetch("/audit-logs").then(d => setAuditLogs(d as AuditLog[])).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du changement.";
      addToast(msg, "error");
    } finally { setPwLoading(false); }
  }

  /* ── Preferences ── */
  function savePreferences() {
    localStorage.setItem("nexledger_currency", currency);
    localStorage.setItem("nexledger_theme", theme);
    addToast("Préférences sauvegardées.", "success");
  }

  /* ── Data export ── */
  async function handleExportCSV() {
    setExportLoading(true);
    try {
      await downloadTransactionsCSV();
      addToast("Export CSV en cours de téléchargement.", "success");
    } catch { addToast("Erreur lors de l'export.", "error"); }
    finally { setExportLoading(false); }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Paramètres
        </h1>
        <p className="text-white/50 mt-1 text-sm">Gérez votre compte, sécurité et préférences.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/5 border border-white/8 rounded-2xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              tab === t.id
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "text-white/40 hover:text-white/70",
            ].join(" ")}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:block">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div className="space-y-4">
          {/* User card */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-[0_0_24px_rgba(99,102,241,0.4)]">
                {user?.email?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div>
                <div className="text-lg font-bold text-white">{user?.email?.split("@")[0] ?? "—"}</div>
                <div className="text-sm text-white/50">{user?.email ?? "Chargement..."}</div>
                <div className="mt-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 inline-block">
                  Compte NexLedger
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white/70 text-sm">
                  {user?.email ?? "—"}
                </div>
                <p className="text-xs text-white/30 mt-1">La modification de l&apos;email sera disponible prochainement.</p>
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              🔐 Changer le mot de passe
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Mot de passe actuel</label>
                <input
                  type="password"
                  value={pwForm.old}
                  onChange={e => setPwForm(f => ({ ...f, old: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={pwForm.new}
                  onChange={e => setPwForm(f => ({ ...f, new: e.target.value }))}
                  placeholder="Min. 8 caractères"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="••••••••"
                  className={[
                    "w-full px-4 py-3 rounded-xl bg-white/5 border text-white text-sm placeholder-white/20 focus:outline-none transition-all",
                    pwForm.confirm && pwForm.new !== pwForm.confirm
                      ? "border-red-500/50 focus:border-red-500/70"
                      : "border-white/10 focus:border-indigo-500/50",
                  ].join(" ")}
                  required
                />
                {pwForm.confirm && pwForm.new !== pwForm.confirm && (
                  <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas.</p>
                )}
              </div>
              <button
                type="submit"
                disabled={pwLoading || !pwForm.old || !pwForm.new || pwForm.new !== pwForm.confirm}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pwLoading ? "Modification..." : "Modifier le mot de passe"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === "security" && (
        <div className="space-y-4">
          {/* 2FA Card */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Authentification à deux facteurs
                  {twofa?.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-medium">Activé</span>
                  )}
                </h2>
                <p className="text-sm text-white/50 mt-1">Protège ton compte avec Google Authenticator ou Authy.</p>
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
                <div className="flex gap-6 items-start flex-wrap">
                  <div className="bg-white p-2 rounded-xl flex-shrink-0">
                    <img src={setup.qr_data} alt="QR Code 2FA" width={140} height={140} />
                  </div>
                  <div className="space-y-3 flex-1 min-w-[200px]">
                    <p className="text-sm text-white/70">Scanne ce QR avec ton app d&apos;authentification, puis entre le code à 6 chiffres.</p>
                    <div className="bg-black/40 rounded-xl p-3 font-mono text-xs text-white/60 break-all">{setup.secret}</div>
                    <div className="flex gap-2">
                      <input type="text" maxLength={6} placeholder="000000"
                        value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={e => e.key === "Enter" && verifyAndEnable()}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 tracking-[0.3em] text-center text-lg font-mono"
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
                  ✅ 2FA actif — votre compte est protégé.
                </div>
                <div className="flex gap-2 items-center">
                  <input type="text" maxLength={6} placeholder="Code pour désactiver"
                    value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    className="w-44 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 text-center tracking-[0.3em] font-mono"
                  />
                  <button onClick={disable2fa}
                    className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-all">
                    Désactiver
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Audit log */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4">📋 Journal d&apos;activité</h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-white/40">Aucune activité enregistrée.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {auditLogs.map(log => {
                  const meta = actionLabels[log.action] ?? { label: log.action, icon: "📌", color: "text-white/60" };
                  return (
                    <div key={log.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <span className="text-base w-6 text-center">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                        {log.details && <span className="text-xs text-white/30 ml-2 truncate">{log.details}</span>}
                      </div>
                      <span className="text-xs text-white/30 shrink-0">{log.created_at.slice(0, 16).replace("T", " ")}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PREFERENCES TAB ── */}
      {tab === "preferences" && (
        <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-5">
          <h2 className="text-base font-bold text-white">Préférences d&apos;affichage</h2>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Devise</label>
            <div className="grid grid-cols-3 gap-2">
              {["CAD", "USD", "EUR"].map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={[
                    "py-2.5 rounded-xl text-sm font-semibold border transition-all",
                    currency === c
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10",
                  ].join(" ")}>
                  {c === "CAD" ? "🍁 CAD" : c === "USD" ? "🇺🇸 USD" : "🇪🇺 EUR"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Thème</label>
            <div className="grid grid-cols-2 gap-2">
              {[["dark", "🌑 Sombre"], ["light", "☀️ Clair (bientôt)"]].map(([val, label]) => (
                <button key={val} onClick={() => val === "dark" && setTheme(val)}
                  disabled={val === "light"}
                  className={[
                    "py-2.5 rounded-xl text-sm font-medium border transition-all",
                    theme === val
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed",
                  ].join(" ")}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Langue</label>
            <div className="grid grid-cols-2 gap-2">
              {[["fr", "🇫🇷 Français"], ["en", "🇬🇧 English (bientôt)"]].map(([val, label]) => (
                <button key={val} disabled={val === "en"}
                  className={[
                    "py-2.5 rounded-xl text-sm font-medium border transition-all",
                    val === "fr"
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "bg-white/5 border-white/10 text-white/30 opacity-30 cursor-not-allowed",
                  ].join(" ")}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={savePreferences}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 transition-all">
            Sauvegarder les préférences
          </button>
        </div>
      )}

      {/* ── DATA TAB ── */}
      {tab === "data" && (
        <div className="space-y-4">
          {/* Export */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-1">📤 Exporter mes données</h2>
            <p className="text-sm text-white/50 mb-4">Téléchargez toutes vos transactions au format CSV (compatible Excel & Google Sheets).</p>
            <button
              onClick={handleExportCSV}
              disabled={exportLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all disabled:opacity-50"
            >
              {exportLoading ? (
                <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {exportLoading ? "Export en cours..." : "Exporter toutes les transactions"}
            </button>
          </div>

          {/* Privacy info */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-1">🔒 Confidentialité</h2>
            <p className="text-sm text-white/50 mb-4">
              Vos données sont chiffrées et ne sont jamais partagées avec des tiers. NexLedger stocke vos informations sur des serveurs sécurisés.
            </p>
            <div className="space-y-2 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Données chiffrées en transit (HTTPS)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Mots de passe hachés (PBKDF2)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Aucune vente de données personnelles
              </div>
            </div>
          </div>

          {/* Delete account */}
          <div className="bg-red-500/5 border border-red-500/20 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-red-400 mb-1">⚠️ Supprimer le compte</h2>
            <p className="text-sm text-white/50 mb-4">
              Cette action est irréversible. Toutes vos données seront définitivement supprimées.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Tapez <span className="text-red-400 font-mono">SUPPRIMER</span> pour confirmer
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="w-full px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-white text-sm placeholder-white/20 focus:outline-none focus:border-red-500/50 transition-all font-mono tracking-wider"
                />
              </div>
              <button
                disabled={deleteConfirm !== "SUPPRIMER"}
                onClick={() => addToast("Contactez le support pour supprimer votre compte.", "info")}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
