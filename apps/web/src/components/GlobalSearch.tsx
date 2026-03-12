"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { globalSearch, SearchResults } from "@/lib/api";
import { money } from "@/lib/format";

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Ouvrir avec Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus auto
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await globalSearch(q);
      setResults(res);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function onQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  const hasResults = results && (
    results.transactions.length > 0 ||
    results.categories.length > 0 ||
    results.goals.length > 0
  );

  return (
    <>
      {/* Bouton loupe */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
        aria-label="Recherche globale"
        title="Recherche (Ctrl+K)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-[#0f0f10] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40 shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Rechercher transactions, catégories, objectifs..."
                className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-base"
              />
              {loading && (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
              )}
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/40">Esc</kbd>
            </div>

            {/* Résultats */}
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {!query.trim() && (
                <div className="py-8 text-center text-sm text-white/30">
                  Commencez à taper pour rechercher...
                </div>
              )}

              {query.trim().length >= 2 && !loading && !hasResults && (
                <div className="py-8 text-center text-sm text-white/30">
                  Aucun résultat pour &ldquo;{query}&rdquo;
                </div>
              )}

              {/* Transactions */}
              {results && results.transactions.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2">Transactions</div>
                  <div className="space-y-1">
                    {results.transactions.map((t) => (
                      <Link
                        key={t.id}
                        href="/transactions"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-white/80 group-hover:text-white truncate">
                            {t.note || t.category_name}
                          </div>
                          <div className="text-xs text-white/30 mt-0.5">{t.date} · {t.category_name}</div>
                        </div>
                        <div className={`text-sm font-bold shrink-0 ml-3 ${t.category_type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                          {money(t.amount)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Catégories */}
              {results && results.categories.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2">Catégories</div>
                  <div className="space-y-1">
                    {results.categories.map((c) => (
                      <Link
                        key={c.id}
                        href="/categories"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${c.type === 'income' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div className="font-medium text-sm text-white/80 group-hover:text-white">{c.name}</div>
                        <div className="ml-auto text-xs text-white/30">{c.type === 'income' ? 'Revenu' : 'Dépense'}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Objectifs */}
              {results && results.goals.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2">Objectifs</div>
                  <div className="space-y-1">
                    {results.goals.map((g) => {
                      const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
                      return (
                        <Link
                          key={g.id}
                          href="/goals"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-white/80 group-hover:text-white truncate">{g.title}</div>
                            <div className="text-xs text-white/30 mt-0.5">{money(g.current_amount)} / {money(g.target_amount)}</div>
                          </div>
                          <div className="text-sm font-bold text-indigo-400 shrink-0 ml-3">{pct.toFixed(0)}%</div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 px-5 py-2.5 flex items-center gap-4 text-xs text-white/25">
              <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↵</kbd> Ouvrir</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Esc</kbd> Fermer</span>
              <span className="ml-auto">Ctrl+K pour ouvrir</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
