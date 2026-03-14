"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type BankStatus = { demo_mode: boolean; env: string };
type DemoBank = { id: string; name: string; logo: string };
type LinkTokenData = { link_token: string; demo_mode: boolean; demo_banks?: DemoBank[] };
type Connection = { id: number; institution_name: string; item_id: string; tx_count: number };
type SyncResult = { added: number; skipped: number; institution_name: string };

// ─── Plaid Link button (real mode) ─────────────────────────────────
function PlaidLinkButton({ linkToken, onSuccess }: { linkToken: string; onSuccess: (token: string) => void }) {
  const [PlaidLink, setPlaidLink] = useState<React.ComponentType<{
    token: string; onSuccess: (public_token: string, metadata: unknown) => void; children: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    import("react-plaid-link").then(m => setPlaidLink(() => m.PlaidLink));
  }, []);

  if (!PlaidLink) return (
    <button disabled className="px-6 py-3 rounded-xl bg-violet-500/50 text-white text-sm font-semibold">
      Chargement...
    </button>
  );

  return (
    <PlaidLink
      token={linkToken}
      onSuccess={(public_token) => onSuccess(public_token)}
    >
      <button className="px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(139,92,246,0.4)]">
        🔗 Connecter ma banque
      </button>
    </PlaidLink>
  );
}

// ─── Demo bank picker ───────────────────────────────────────────────
function DemoBankPicker({
  banks, linkToken, onSuccess,
}: {
  banks: DemoBank[];
  linkToken: string;
  onSuccess: (token: string, institutionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(139,92,246,0.4)]"
      >
        🔗 Connecter une banque (Démo)
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open ? "-rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
          {banks.map(bank => (
            <button
              key={bank.id}
              onClick={() => {
                onSuccess(linkToken, bank.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-left"
            >
              <span className="text-2xl">{bank.logo}</span>
              <span className="text-sm text-white/80">{bank.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connection card ────────────────────────────────────────────────
function ConnectionCard({
  conn,
  onSync,
  onDelete,
}: {
  conn: Connection;
  onSync: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const initials = conn.institution_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{conn.institution_name}</div>
          <div className="text-xs text-white/40 mt-0.5">
            {conn.tx_count} transaction{conn.tx_count !== 1 ? "s" : ""} importée{conn.tx_count !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSync(conn.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Sync
        </button>
        <button
          onClick={() => onDelete(conn.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Déconnecter
        </button>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────
export default function BankPage() {
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [linkData, setLinkData] = useState<LinkTokenData | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<number | null>(null);
  const { addToast } = useToast();

  async function loadData() {
    try {
      const [s, conns] = await Promise.all([
        apiFetch("/bank/status") as Promise<BankStatus>,
        apiFetch("/bank/connections") as Promise<Connection[]>,
      ]);
      setStatus(s);
      setConnections(conns);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadLinkToken() {
    try {
      const data = await apiFetch("/bank/link-token") as LinkTokenData;
      setLinkData(data);
    } catch {
      addToast("Impossible de créer le lien bancaire.", "error");
    }
  }

  useEffect(() => {
    loadData();
    loadLinkToken();
  }, []);

  const handleBankConnected = useCallback(async (publicToken: string, institutionId?: string) => {
    try {
      await apiFetch("/bank/exchange-token", {
        method: "POST",
        body: JSON.stringify({ public_token: publicToken, institution_id: institutionId }),
      });
      addToast("Banque connectée et transactions importées !", "success");
      loadData();
      loadLinkToken(); // refresh token
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de connexion.";
      addToast(msg, "error");
    }
  }, []);

  async function syncConnection(id: number) {
    setSyncing(id);
    try {
      const result = await apiFetch(`/bank/sync/${id}`, { method: "POST" }) as SyncResult;
      addToast(`${result.institution_name} : ${result.added} nouvelles transactions`, "success");
      loadData();
    } catch {
      addToast("Erreur lors de la synchronisation.", "error");
    } finally {
      setSyncing(null);
    }
  }

  async function deleteConnection(id: number) {
    try {
      await apiFetch(`/bank/connections/${id}`, { method: "DELETE" });
      addToast("Banque déconnectée.", "info");
      loadData();
    } catch {
      addToast("Erreur lors de la déconnexion.", "error");
    }
  }

  async function syncAll() {
    setSyncing(-1);
    try {
      const result = await apiFetch("/bank/sync-all", { method: "POST" }) as { synced: number; results: { added: number }[] };
      const totalAdded = result.results.reduce((s, r) => s + (r.added || 0), 0);
      addToast(`${result.synced} banque${result.synced > 1 ? "s" : ""} synchronisée${result.synced > 1 ? "s" : ""} — ${totalAdded} nouvelles transactions`, "success");
      loadData();
    } catch {
      addToast("Erreur lors de la synchronisation globale.", "error");
    } finally {
      setSyncing(null);
    }
  }

  return (
    <main className="animate-fade-in-up max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Connexion{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Bancaire
          </span>
        </h1>
        <p className="text-white/50 mt-2 text-sm">
          Importez automatiquement vos transactions depuis votre banque.
        </p>
      </div>

      {/* Mode badge */}
      {status && (
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium ${
          status.demo_mode
            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        }`}>
          {status.demo_mode ? "🎭 Mode Démo" : "🔌 Plaid " + status.env}
          {status.demo_mode && (
            <span className="text-white/30">— données fictives réalistes, aucune vraie banque connectée</span>
          )}
        </div>
      )}

      {/* Connect button */}
      {!loading && linkData && (
        <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-2">➕ Ajouter une banque</h2>
          <p className="text-sm text-white/50 mb-5">
            {linkData.demo_mode
              ? "Choisissez une banque démo pour simuler l'importation de transactions."
              : "Connectez votre compte bancaire canadien en quelques secondes via Plaid."}
          </p>

          {linkData.demo_mode && linkData.demo_banks ? (
            <DemoBankPicker
              banks={linkData.demo_banks}
              linkToken={linkData.link_token}
              onSuccess={(token, id) => handleBankConnected(token, id)}
            />
          ) : (
            <PlaidLinkButton
              linkToken={linkData.link_token}
              onSuccess={(token) => handleBankConnected(token)}
            />
          )}
        </div>
      )}

      {/* Connected banks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">
            🏦 Banques connectées
            {connections.length > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/20">
                {connections.length}
              </span>
            )}
          </h2>
          {connections.length > 1 && (
            <button
              onClick={syncAll}
              disabled={syncing !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {syncing === -1 ? "Synchronisation..." : "Tout synchroniser"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/30 animate-pulse">Chargement des connexions...</div>
        ) : connections.length === 0 ? (
          <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🏦</div>
            <p className="text-white/50 text-sm">Aucune banque connectée.</p>
            <p className="text-white/30 text-xs mt-1">Cliquez sur &quot;Ajouter une banque&quot; ci-dessus pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <ConnectionCard
                key={conn.id}
                conn={syncing === conn.id ? { ...conn } : conn}
                onSync={syncConnection}
                onDelete={deleteConnection}
              />
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4">ℹ️ Comment ça fonctionne</h2>
        <div className="space-y-3">
          {[
            { icon: "🔒", title: "Sécurisé", desc: "Vos identifiants bancaires ne sont jamais stockés — NexLedger utilise Plaid, un intermédiaire certifié." },
            { icon: "🔄", title: "Synchronisation automatique", desc: "Les nouvelles transactions sont importées à chaque synchronisation et dédupliquées automatiquement." },
            { icon: "🏷️", title: "Catégorisation intelligente", desc: "Nexus analyse les transactions importées et suggère des catégories basées sur les marchands." },
            { icon: "🗑️", title: "Révocable", desc: "Déconnectez votre banque à tout moment — toutes les données importées sont supprimées." },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{item.icon}</span>
              <div>
                <div className="text-sm font-medium text-white">{item.title}</div>
                <div className="text-xs text-white/50 mt-0.5 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {status?.demo_mode && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5">
          <div className="text-sm font-semibold text-amber-400 mb-2">🎭 Activer le mode réel (Plaid)</div>
          <p className="text-xs text-white/50 leading-relaxed">
            Pour connecter de vraies banques canadiennes, créez un compte gratuit sur{" "}
            <span className="text-violet-400">dashboard.plaid.com</span> (sandbox gratuit),
            puis ajoutez vos clés dans le fichier <code className="text-white/60">.env</code> du backend :
          </p>
          <pre className="mt-3 bg-black/30 rounded-xl p-3 text-xs text-white/60 font-mono">
{`PLAID_CLIENT_ID=votre_client_id
PLAID_SECRET=votre_secret_sandbox
PLAID_ENV=sandbox`}
          </pre>
        </div>
      )}
    </main>
  );
}
