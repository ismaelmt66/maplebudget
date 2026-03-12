"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";
import { me } from "@/lib/api";
import QuickAddTransaction from "./QuickAddTransaction";

function NavLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-[14px] text-sm font-medium transition-all duration-300 relative group",
        active
          ? "text-white bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          : "text-white/60 hover:text-white hover:bg-white/5",
      ].join(" ")}
    >
      {icon && <span className={active ? "text-indigo-400" : "text-white/50 group-hover:text-white/80 transition-colors"}>{icon}</span>}
      {label}
      {active && (
        <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-t-full bg-gradient-to-r from-indigo-400 to-purple-400 shadow-[0_-2px_8px_rgba(129,140,248,0.8)]" />
      )}
    </Link>
  );
}

function Dropdown({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 200); // slight delay to cross gaps
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={[
          "flex items-center gap-2 px-3 py-2 rounded-[14px] text-sm font-medium transition-all duration-300",
          isOpen ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" : "text-white/60 hover:text-white hover:bg-white/5"
        ].join(" ")}
      >
        {icon && <span className={isOpen ? "text-indigo-400" : "text-white/50 transition-colors"}>{icon}</span>}
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ml-0.5 ${isOpen ? "-rotate-180 text-white" : "opacity-50"}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-300 ease-out ${isOpen ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-3 invisible"
          }`}
      >
        <div className="w-64 p-2 rounded-2xl bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_20px_rgba(99,102,241,0.15)] flex flex-col gap-1 relative overflow-hidden">
          {/* Internal Glow for Glassmorphism */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px] pointer-events-none mix-blend-screen" />
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function DropdownItem({ href, label, desc, icon }: { href: string; label: string; desc: string; icon: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link href={href} className={`flex items-start gap-3 p-3 rounded-[14px] transition-all duration-200 group ${active ? "bg-white/5" : "hover:bg-white/5"}`}>
      <div className={`mt-0.5 rounded-xl p-2.5 transition-colors ${active ? "bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]" : "bg-black/40 border border-white/5 text-white/50 group-hover:text-indigo-300 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 group-hover:shadow-[0_0_10px_rgba(99,102,241,0.2)]"}`}>
        {icon}
      </div>
      <div>
        <div className={`text-sm font-semibold tracking-tight transition-colors ${active ? "text-white" : "text-white/80 group-hover:text-white"}`}>{label}</div>
        <div className="text-xs text-white/40 group-hover:text-white/60 line-clamp-1 mt-0.5 leading-snug">{desc}</div>
      </div>
    </Link>
  );
}

/**
 * Icons (Inline SVGs)
 */
const Icons = {
  Dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>,
  Transactions: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  Tools: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /><rect x="3" y="8" width="18" height="12" rx="2" /></svg>, // Generic tools icon
  Magic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>,
  Recurring: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
  Patrimoine: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>,
  Goals: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  Categories: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  Analytics: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  Coach: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Budget: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  Achievements: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
};

/**
 * Global navigation header.
 */
export default function HeaderBar() {
  const [hidden, setHidden] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const t = getToken();
    setToken(t);

    if (t) {
      me()
        .then((u) => setEmail(u.email))
        .catch(() => {
          clearToken();
          setToken(null);
          setEmail(null);
        });
    }
  }, []);

  function logout() {
    clearToken();
    setToken(null);
    setEmail(null);
    window.location.href = "/login";
  }

  // Scroll detection
  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;

        if (Math.abs(delta) > 10) {
          if (delta > 0 && y > 100) setHidden(true); // scoll down
          if (delta < 0) setHidden(false);           // scroll up
        }

        lastY.current = y;
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-50 transition-transform duration-300 ease-out",
        hidden ? "-translate-y-[110%]" : "translate-y-0",
      ].join(" ")}
    >
      <div className="border-b border-white/5 bg-black/30 pt-3 pb-3" style={{ backdropFilter: "blur(20px)" }}>
        <div className="mb-container flex items-center justify-between gap-4 relative">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center transition-all duration-300 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.15))",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 0 30px rgba(99,102,241,0.2) inset, 0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#brandGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="brandGrad" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">NexLeger</div>
            </div>
          </Link>

          {/* Desktop nav */}
          {token && (
            <nav className="hidden lg:flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
              <NavLink href="/dashboard" label="Dashboard" icon={Icons.Dashboard} />
              <NavLink href="/transactions" label="Transactions" icon={Icons.Transactions} />
              <NavLink href="/recurring" label="Récurrentes" icon={Icons.Recurring} />

              <div className="w-px h-6 bg-white/10 mx-2" /> {/* Divider */}

              <Dropdown label="Outils" icon={Icons.Tools}>
                <DropdownItem href="/budget" label="Budgets" desc="Alertes et suivi budgétaire" icon={Icons.Budget} />
                <DropdownItem href="/assets" label="Patrimoine Net" desc="Suivez tous vos comptes" icon={Icons.Patrimoine} />
                <DropdownItem href="/goals" label="Objectifs" desc="Épargnez pour l'avenir" icon={Icons.Goals} />
                <DropdownItem href="/categories" label="Catégories & Budgets" desc="Organisez vos dépenses" icon={Icons.Categories} />
              </Dropdown>

              <Dropdown label="Intelligence" icon={Icons.Magic}>
                <DropdownItem href="/coach" label="Coach IA" desc="Analyses et conseils personnalisés" icon={Icons.Coach} />
                <DropdownItem href="/analytics" label="Analytique" desc="Graphiques et tendances avancés" icon={Icons.Analytics} />
                <DropdownItem href="/achievements" label="Trophées" desc="Récompenses de progression" icon={Icons.Achievements} />
              </Dropdown>
            </nav>
          )}

          {/* Auth actions */}
          <div className="flex items-center gap-3 relative z-10">
            {token ? (
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
                    {email?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white/80">{email?.split('@')[0]}</span>
                </div>
                <button onClick={logout} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10" aria-label="Déconnexion" title="Déconnexion">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </button>
              </div>
            ) : (
              <div className="hidden md:flex gap-2">
                <Link className="px-5 py-2 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all" href="/login">
                  Se connecter
                </Link>
                <Link className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all" href="/register">
                  Commencer
                </Link>
              </div>
            )}

            {/* Quick Add Button & Mobile Hamburger */}
            {token && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsQuickAddOpen(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-[14px] bg-white text-black hover:bg-indigo-100 shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all transform hover:scale-105"
                  aria-label="Ajout rapide transaction"
                  title="Ajout rapide"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>

                <button
                  className="lg:hidden p-2 rounded-xl text-white/70 hover:text-white bg-white/5"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && token && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-black/90 backdrop-blur-3xl border-b border-white/10 shadow-2xl p-4 flex flex-col gap-2 overflow-y-auto max-h-[80vh]">
          <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl bg-white/5 font-medium">Dashboard</Link>
          <Link href="/transactions" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl bg-white/5 font-medium">Transactions</Link>
          <Link href="/recurring" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl bg-white/5 font-medium">Récurrentes</Link>
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest px-2 mt-2">Outils</div>
          <Link href="/budget" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5">💰 Budgets</Link>
          <Link href="/assets" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5">Patrimoine Net</Link>
          <Link href="/goals" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5">Objectifs</Link>
          <Link href="/categories" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5">Catégories & Budgets</Link>
          <div className="text-xs font-bold text-purple-400/60 uppercase tracking-widest px-2 mt-2">Intelligence</div>
          <Link href="/coach" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5">Coach IA</Link>
          <Link href="/analytics" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5">Analytique</Link>
          <Link href="/achievements" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5">Trophées</Link>
          <div className="h-px w-full bg-white/10 my-2"></div>
          <button onClick={logout} className="px-4 py-3 rounded-xl text-red-400 font-medium text-left">Déconnexion</button>
        </div>
      )}

      <QuickAddTransaction
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent('nexleger-tx-added'));
        }}
      />
    </header>
  );
}