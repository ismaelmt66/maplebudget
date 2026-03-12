"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { money } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

type Member = { member_id: number; email: string; role: string; joined_at: string };
type Invite = { id: number; invite_email: string; token: string; status: string; created_at: string };
type Household = { owner_email: string; members: Member[]; pending_invites: Invite[] };
type SharedDash = {
  member_count: number; month: string;
  total_income: number; total_expense: number; net: number;
  members: { user_id: number; email: string; tx_count: number; total_spent: number }[];
};

export default function HouseholdPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [shared, setShared] = useState<SharedDash | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"members" | "dashboard">("members");
  const { addToast } = useToast();

  async function load() {
    try {
      const [h, d] = await Promise.all([
        apiFetch("/household") as Promise<Household>,
        apiFetch("/household/shared-dashboard") as Promise<SharedDash>,
      ]);
      setHousehold(h);
      setShared(d);
    } catch {
      // solo user, no household yet
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      await apiFetch("/household/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      addToast(`Invitation envoyée à ${inviteEmail}`, "success");
      setInviteEmail("");
      load();
    } catch {
      addToast("Erreur lors de l'envoi de l'invitation.", "error");
    } finally {
      setSending(false);
    }
  }

  async function removeMember(memberId: number) {
    try {
      await apiFetch(`/household/members/${memberId}`, { method: "DELETE" });
      addToast("Membre retiré.", "info");
      load();
    } catch {
      addToast("Erreur lors de la suppression.", "error");
    }
  }

  return (
    <main className="animate-fade-in-up max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Mode{" "}
          <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
            Couple / Famille
          </span>
        </h1>
        <p className="text-white/50 mt-2 text-sm">
          Gérez vos finances en commun et visualisez le budget consolidé de votre foyer.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(["members", "dashboard"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-all ${tab === t ? "text-white bg-white/10 border-b-2 border-pink-400" : "text-white/40 hover:text-white/70"}`}>
            {t === "members" ? "👥 Membres" : "📊 Budget Partagé"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-white/30 animate-pulse">Chargement du foyer...</div>
      ) : tab === "members" ? (
        <div className="space-y-5">
          {/* Invite form */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4">✉️ Inviter un membre</h2>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="Email de votre partenaire"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendInvite()}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50"
              />
              <button
                onClick={sendInvite}
                disabled={sending}
                className="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(236,72,153,0.4)] disabled:opacity-50"
              >
                {sending ? "Envoi..." : "Inviter"}
              </button>
            </div>
          </div>

          {/* Members list */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-4">👥 Membres du foyer</h2>

            {/* Owner */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-sm font-bold text-white">
                  {household?.owner_email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm text-white font-medium">{household?.owner_email}</div>
                  <div className="text-xs text-white/40">Propriétaire</div>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/20">Vous</span>
            </div>

            {household?.members && household.members.length > 0 ? (
              household.members.map(m => (
                <div key={m.member_id} className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white">
                      {m.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{m.email}</div>
                      <div className="text-xs text-white/40">Membre depuis {m.joined_at.slice(0, 10)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeMember(m.member_id)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    Retirer
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/40 mt-3">Aucun membre encore. Invitez votre partenaire ci-dessus.</p>
            )}
          </div>

          {/* Pending invites */}
          {household?.pending_invites && household.pending_invites.length > 0 && (
            <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
              <h2 className="text-base font-bold text-white mb-4">⏳ Invitations en attente</h2>
              <div className="space-y-2">
                {household.pending_invites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-white/5">
                    <div>
                      <div className="text-sm text-white/80">{inv.invite_email}</div>
                      <div className="text-xs text-white/30">Envoyée le {inv.created_at.slice(0, 10)}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20">En attente</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accept invite */}
          <AcceptInviteSection onAccepted={load} />
        </div>
      ) : (
        /* Shared Dashboard */
        shared && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                <div className="text-xs text-white/50 mb-1">Revenus du foyer</div>
                <div className="text-xl font-bold text-emerald-400">{money(shared.total_income)}</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <div className="text-xs text-white/50 mb-1">Dépenses du foyer</div>
                <div className="text-xl font-bold text-red-400">{money(shared.total_expense)}</div>
              </div>
              <div className={`${shared.net >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"} border rounded-2xl p-4 text-center`}>
                <div className="text-xs text-white/50 mb-1">Net du foyer</div>
                <div className={`text-xl font-bold ${shared.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money(shared.net)}</div>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
              <h2 className="text-base font-bold text-white mb-4">📊 Contribution par membre</h2>
              <div className="space-y-3">
                {shared.members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-xs font-bold text-white">
                        {m.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm text-white/80">{m.email.split("@")[0]}</div>
                        <div className="text-xs text-white/40">{m.tx_count} transaction{m.tx_count !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white">{money(m.total_spent)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-white/20 text-center">
              Données du mois en cours — {shared.month} — {shared.member_count} membre{shared.member_count !== 1 ? "s" : ""}
            </p>
          </div>
        )
      )}
    </main>
  );
}

function AcceptInviteSection({ onAccepted }: { onAccepted: () => void }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  async function accept() {
    if (!token.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`/household/accept/${token.trim()}`, { method: "POST" });
      addToast("Vous avez rejoint le foyer !", "success");
      setToken("");
      onAccepted();
    } catch {
      addToast("Token invalide ou invitation expirée.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
      <h2 className="text-base font-bold text-white mb-2">🔗 Rejoindre un foyer</h2>
      <p className="text-xs text-white/40 mb-4">Vous avez reçu un token d&apos;invitation ? Entrez-le ci-dessous.</p>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Token d'invitation"
          value={token}
          onChange={e => setToken(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50 font-mono text-xs"
        />
        <button
          onClick={accept}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          {loading ? "..." : "Rejoindre"}
        </button>
      </div>
    </div>
  );
}
