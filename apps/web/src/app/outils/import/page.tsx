"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getCategories, Category } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

type BankStatus = { demo_mode: boolean; env: string };
type DemoBank = { id: string; name: string; logo: string };
type LinkTokenData = { link_token: string; demo_mode: boolean; demo_banks?: DemoBank[] };
type Connection = { id: number; institution_name: string; item_id: string; tx_count: number };
type SyncResult = { added: number; skipped: number; institution_name: string };
type PreviewRow = { date: string; amount: number; description: string };

// ── File Import Section ─────────────────────────────────────────────
function FileImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | "">("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const fileType = file?.name?.toLowerCase().endsWith(".csv")
    ? "csv"
    : file?.name?.toLowerCase().match(/\.(ofx|qfx)$/)
      ? "ofx"
      : null;

  async function handlePreview() {
    if (!file || fileType !== "csv") return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = getToken();
      const API_BASE = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";
      const res = await fetch(`${API_BASE}/import/preview/csv`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPreview(data.preview || []);
      setPreviewTotal(data.total || 0);
      setPreviewErrors(data.errors || []);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Preview failed", "error");
    }
  }

  async function handleImport() {
    if (!file || !fileType) return;
    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    if (selectedCatId) formData.append("default_category_id", String(selectedCatId));

    try {
      const token = getToken();
      const API_BASE = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";
      const endpoint = fileType === "csv" ? "/import/csv" : "/import/ofx";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Import failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
      }
      const data = await res.json();
      setResult({ imported: data.imported, skipped: data.skipped, errors: data.errors || [] });
      addToast(`${data.imported} transactions imported successfully!`, "success");
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview([]);
    setPreviewTotal(0);
    setPreviewErrors([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import CSV / OFX / QFX
        </h2>
        <p className="text-sm text-white/50 mt-1">
          Upload a bank statement file. Supported formats: CSV, OFX, QFX.
        </p>
      </div>

      {/* File picker */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <label className="flex-1 w-full cursor-pointer">
          <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all hover:border-violet-500/50 ${file ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10"}`}>
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">{fileType === "csv" ? "\uD83D\uDCC4" : "\uD83C\uDFE6"}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">{file.name}</div>
                  <div className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-3xl mb-2 opacity-30">{"\uD83D\uDCC1"}</div>
                <div className="text-sm text-white/50">Click to select or drag a file</div>
                <div className="text-xs text-white/30 mt-1">.csv, .ofx, .qfx</div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.ofx,.qfx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFile(f); setPreview([]); setResult(null); }
            }}
          />
        </label>
      </div>

      {/* Category selector */}
      {file && (
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <label className="flex-1 text-sm text-white/70">
            Default category for uncategorized transactions
            <select
              className="mb-input mt-1.5"
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Auto-detect</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            {fileType === "csv" && !preview.length && (
              <button onClick={handlePreview} className="mb-btn">Preview</button>
            )}
            <button
              onClick={handleImport}
              disabled={importing}
              className="mb-btn mb-btn-primary"
            >
              {importing ? "Importing..." : `Import ${fileType?.toUpperCase()}`}
            </button>
            <button onClick={reset} className="mb-btn">Reset</button>
          </div>
        </div>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div>
          <div className="text-xs text-white/50 mb-2">
            Preview: showing {preview.length} of {previewTotal} transactions
          </div>
          <div className="overflow-x-auto max-h-64 rounded-xl border border-white/5">
            <table className="w-full text-xs">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-white/40">Date</th>
                  <th className="text-right px-3 py-2 text-white/40">Amount</th>
                  <th className="text-left px-3 py-2 text-white/40">Description</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 text-white/70">{r.date}</td>
                    <td className="px-3 py-2 text-right font-mono text-white">${r.amount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-white/60 truncate max-w-[200px]">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview errors */}
      {previewErrors.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="text-xs font-semibold text-amber-400 mb-1">Parse warnings ({previewErrors.length})</div>
          <div className="text-xs text-white/50 max-h-24 overflow-y-auto space-y-0.5">
            {previewErrors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
            {previewErrors.length > 10 && <div>...and {previewErrors.length - 10} more</div>}
          </div>
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className={`rounded-xl p-4 border ${result.imported > 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{result.imported > 0 ? "\u2705" : "\u26A0\uFE0F"}</span>
            <div>
              <div className="text-sm font-semibold text-white">
                {result.imported} imported, {result.skipped} skipped (duplicates)
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs text-white/50 mt-1">
                  {result.errors.length} warning(s)
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
          Import{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Transactions
          </span>
        </h1>
        <p className="text-white/50 mt-2 text-sm">
          Import transactions from files or connect your bank directly.
        </p>
      </div>

      {/* File Import */}
      <FileImportSection />

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
