"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { me, apiFetch, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type AuditLog = { id: number; action: string; details: string | null; created_at: string };

export default function ProfilPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Audit logs
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const u = await me();
      setEmail(u.email);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const data = await apiFetch("/audit-logs") as AuditLog[];
      setLogs(data.slice(0, 20));
    } catch {
      // non-critical
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadLogs(); }, [load, loadLogs]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd.length < 6) { setPwdMsg({ type: "err", text: "Nouveau mot de passe trop court (min 6)." }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ type: "err", text: "Les mots de passe ne correspondent pas." }); return; }

    try {
      setPwdLoading(true);
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      setPwdMsg({ type: "ok", text: "Mot de passe modifie avec succes." });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) router.push("/login");
      else setPwdMsg({ type: "err", text: (e as Error)?.message ?? "Erreur" });
    } finally {
      setPwdLoading(false);
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

  const initials = email?.charAt(0).toUpperCase() ?? "?";

  return (
    <main className="mb-container py-10 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Profil</span>
        </h1>
        <p className="text-white/50 mt-1">Informations personnelles et securite</p>
      </div>

      {/* Profile Card */}
      <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]">
          {initials}
        </div>
        <div>
          <div className="text-lg font-bold text-white">{email}</div>
          <div className="text-sm text-white/40 mt-0.5">Compte NexLedger</div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 max-w-xl">
        <h2 className="text-lg font-bold mb-4">Changer le mot de passe</h2>

        {pwdMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${pwdMsg.type === "ok" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}>
            {pwdMsg.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">Mot de passe actuel</label>
            <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Nouveau mot de passe</label>
            <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required autoComplete="new-password" />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Confirmer le nouveau mot de passe</label>
            <Input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={pwdLoading}>
            {pwdLoading ? "Modification..." : "Modifier le mot de passe"}
          </Button>
        </form>
      </div>

      {/* Audit Logs */}
      <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
        <h2 className="text-lg font-bold mb-4">Activite Recente</h2>
        {logsLoading ? (
          <div className="flex items-center gap-3 py-6 text-white/40">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Chargement...
          </div>
        ) : logs.length === 0 ? (
          <p className="text-white/40 text-sm py-4">Aucune activite enregistree.</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white/80">{log.action}</div>
                  {log.details && <div className="text-xs text-white/40 truncate mt-0.5">{log.details}</div>}
                </div>
                <div className="text-xs text-white/30 shrink-0 ml-4">
                  {new Date(log.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
