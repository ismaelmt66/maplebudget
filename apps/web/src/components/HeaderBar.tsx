"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";
import { me } from "@/lib/api";
import { archiveChatHistory } from "@/lib/useChatHistory";
import QuickAddTransaction from "./QuickAddTransaction";
import { Logo } from "./Logo";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";

/* ------------------------------------------------------------------ */
/* NavLink                                                              */
/* ------------------------------------------------------------------ */
function NavLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-sm font-medium transition-all duration-200 relative group",
        active
          ? "text-white bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          : "text-white/60 hover:text-white hover:bg-white/5",
      ].join(" ")}
    >
      {icon && (
        <span className={active ? "text-indigo-400" : "text-white/40 group-hover:text-white/70 transition-colors"}>
          {icon}
        </span>
      )}
      {label}
      {active && (
        <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-t-full bg-gradient-to-r from-indigo-400 to-purple-400 shadow-[0_-2px_8px_rgba(129,140,248,0.8)]" />
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Dropdown                                                             */
/* ------------------------------------------------------------------ */
function Dropdown({
  label,
  icon,
  accent,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  accent?: string; // tailwind color class prefix e.g. "violet" | "emerald"
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  const glowColor =
    accent === "violet" ? "rgba(139,92,246,0.15)" :
    accent === "emerald" ? "rgba(52,211,153,0.12)" :
    accent === "sky" ? "rgba(56,189,248,0.12)" :
    accent === "amber" ? "rgba(251,191,36,0.12)" :
    "rgba(99,102,241,0.15)";

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={[
          "flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-sm font-medium transition-all duration-200",
          isOpen ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" : "text-white/60 hover:text-white hover:bg-white/5",
        ].join(" ")}
      >
        {icon && (
          <span className={isOpen ? "text-indigo-400" : "text-white/40 transition-colors"}>
            {icon}
          </span>
        )}
        {label}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ml-0.5 ${isOpen ? "-rotate-180 text-white/70" : "opacity-40"}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 transition-all duration-200 ease-out z-50 ${
          isOpen ? "opacity-100 translate-y-0 visible pointer-events-auto" : "opacity-0 translate-y-2 invisible pointer-events-none"
        }`}
      >
        <div
          className="min-w-[240px] p-1.5 rounded-2xl bg-[#080808]/95 backdrop-blur-2xl border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.9)] relative overflow-hidden"
          style={{ boxShadow: `0 24px 48px -12px rgba(0,0,0,0.9), 0 0 24px ${glowColor}` }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-20 rounded-full blur-[40px] opacity-60"
              style={{ background: glowColor }} />
          </div>
          <div className="relative z-10 flex flex-col gap-0.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DropdownItem                                                         */
/* ------------------------------------------------------------------ */
function DropdownItem({
  href,
  label,
  desc,
  icon,
  badge,
}: {
  href: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
        active ? "bg-white/8" : "hover:bg-white/5"
      }`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          active
            ? "bg-indigo-500/25 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
            : "bg-white/5 text-white/40 group-hover:text-white/80 group-hover:bg-white/10"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium leading-tight transition-colors ${active ? "text-white" : "text-white/75 group-hover:text-white"}`}>
          {label}
          {badge && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold uppercase tracking-wide">
              {badge}
            </span>
          )}
        </div>
        <div className="text-xs text-white/35 mt-0.5 leading-tight line-clamp-1 group-hover:text-white/50 transition-colors">
          {desc}
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */
const I = {
  Dashboard:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
  Transactions: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Recurring:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  Budget:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Categories:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Assets:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
  Invest:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>,
  Goals:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Calendar:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Simulator:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
  Reports:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" /><line x1="12" x2="12" y1="18" y2="12" /><line x1="18" x2="18" y1="18" y2="12" /><line x1="6" x2="6" y1="18" y2="16" /><path d="M22 22l-3-3" /><path d="M16 16l3 3" /></svg>,
  Coach:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Import:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  Export:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  Profile:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  Security:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  Settings:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Support:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  Logout:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Finances:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12z"/><path d="M12 6v6l4 2"/></svg>,
  Insights:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/></svg>,
  Tools:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Wealth:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  Plan:         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M22 12a10 10 0 0 0-10-10v10z" /></svg>,
  Account:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M12 12v1.5A2.5 2.5 0 0 0 9.5 16h-1A2.5 2.5 0 0 0 6 18.5V21h12v-2.5A2.5 2.5 0 0 0 15.5 16h-1a2.5 2.5 0 0 0-2.5-2.5V12z"/></svg>,
};

/* ------------------------------------------------------------------ */
/* Navigation Config                                                    */
/* ------------------------------------------------------------------ */
const navigationConfig = [
  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: I.Dashboard },
  {
    type: 'dropdown', label: 'Finances', icon: I.Finances, accent: 'indigo',
    items: [
      { href: "/finances/transactions", label: "Transactions", desc: "Historique & ajout de mouvements", icon: I.Transactions },
      { href: "/finances/budget", label: "Budgets", desc: "Limites & alertes par categorie", icon: I.Budget },
      { href: "/finances/categories", label: "Categories", desc: "Organiser vos depenses & revenus", icon: I.Categories },
      { href: "/finances/recurring", label: "Recurrentes", desc: "Abonnements & paiements fixes", icon: I.Recurring },
    ]
  },
  {
    type: 'dropdown', label: 'Patrimoine', icon: I.Wealth, accent: 'emerald',
    items: [
      { href: "/patrimoine/assets", label: "Actifs & Comptes", desc: "Bilan patrimonial complet", icon: I.Assets },
      { href: "/patrimoine/investments", label: "Investissements", desc: "Suivi de portefeuille", icon: I.Invest },
      { href: "/planification/goals", label: "Objectifs", desc: "Epargne & projets financiers", icon: I.Goals },
      { href: "/planification/simulator", label: "Simulateur", desc: "Projections & scenarios", icon: I.Simulator },
    ]
  },
  {
    type: 'dropdown', label: 'Insights', icon: I.Insights, accent: 'sky',
    items: [
      { href: "/insights/coach", label: "Analyse IA", desc: "Votre assistant financier", icon: I.Coach },
      { href: "/insights/reports", label: "Rapports", desc: "Graphiques & tendances", icon: I.Reports },
      { href: "/planification/calendar", label: "Calendrier", desc: "Transactions jour par jour", icon: I.Calendar },
      { href: "/outils/import", label: "Import", desc: "Connexion bancaire securisee", icon: I.Import },
      { href: "/outils/export", label: "Export CSV", desc: "Telecharger vos donnees", icon: I.Export },
    ]
  },
];


/* ------------------------------------------------------------------ */
/* HeaderBar                                                            */
/* ------------------------------------------------------------------ */
export default function HeaderBar() {
  const [hidden, setHidden] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);

  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // We need to run this in a timeout to avoid hydration errors
    setTimeout(() => {
      const t = getToken();
      setToken(t);
      if (t) {
        me()
          .then((u) => setEmail(u.email))
          .catch(() => { clearToken(); setToken(null); setEmail(null); });
      }
    }, 0);
  }, []);

  function logout() {
    archiveChatHistory(email);
    clearToken();
    setToken(null);
    setEmail(null);
    window.location.href = "/login";
  }

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (Math.abs(delta) > 10) {
          if (delta > 0 && y > 80) setHidden(true);
          if (delta < 0) setHidden(false);
        }
        lastY.current = y;
        ticking.current = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials = email?.charAt(0).toUpperCase() ?? "?";
  const username = email?.split("@")[0] ?? "";

  return (
    <header
      className={[
        "sticky top-0 z-50 transition-transform duration-300 ease-out",
        hidden ? "-translate-y-[110%]" : "translate-y-0",
      ].join(" ")}
    >
      <div className="border-b border-white/[0.06] bg-black/40 py-2.5" style={{ backdropFilter: "blur(24px)" }}>
        <div className="mb-container flex items-center justify-between gap-4 relative">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Logo />
          </Link>

          {/* Desktop navigation */}
          {token && (
            <nav className="hidden lg:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
              {navigationConfig.map(nav => {
                if (nav.type === 'link' && nav.href) {
                  return <NavLink key={nav.href} href={nav.href} label={nav.label} icon={nav.icon} />
                }
                if (nav.type === 'dropdown' && nav.items) {
                  return (
                    <Dropdown key={nav.label} label={nav.label} icon={nav.icon} accent={nav.accent}>
                      {nav.items.map(item => (
                        <DropdownItem key={item.href} {...item} />
                      ))}
                    </Dropdown>
                  )
                }
                return null;
              })}
            </nav>
          )}

          {/* Right section */}
          <div className="flex items-center gap-2 shrink-0">
            {token ? (
              <>
                <GlobalSearch />
                <NotificationBell />

                {/* Quick add */}
                <button
                  onClick={() => setIsQuickAddOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_16px_rgba(99,102,241,0.5)] transition-all hover:scale-105 active:scale-95"
                  aria-label="Ajout rapide"
                  title="Ajout rapide (Ctrl+K)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>

                {/* User menu */}
                <Dropdown
                  label=""
                  icon={
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {initials}
                      </div>
                      <span className="hidden xl:block text-sm font-medium text-white/80 max-w-[100px] truncate">{username}</span>
                    </div>
                  }
                  accent="indigo"
                >
                  <div className="px-3 py-2 border-b border-white/8 mb-1">
                    <div className="text-xs font-semibold text-white/80 truncate">{email}</div>
                    <div className="text-[11px] text-white/35 mt-0.5">Compte NexLedger</div>
                  </div>
                  <DropdownItem href="/compte/profil" label="Profil" desc="Informations personnelles" icon={I.Profile} />
                  <DropdownItem href="/compte/settings" label="Parametres" desc="Preferences & configuration" icon={I.Settings} />
                  <DropdownItem href="/compte/security" label="Securite" desc="2FA & mot de passe" icon={I.Security} />
                  <DropdownItem href="/compte/support" label="Support" desc="Aide & FAQ" icon={I.Support} />
                  <div className="mt-1 border-t border-white/8 pt-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        {I.Logout}
                      </div>
                      Deconnexion
                    </button>
                  </div>
                </Dropdown>

                {/* Mobile hamburger */}
                <button
                  className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label="Menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isMobileMenuOpen
                      ? <><path d="M18 6L6 18M6 6l12 12" /></>
                      : <><line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="16" x2="21" y2="16" /></>
                    }
                  </svg>
                </button>
              </>
            ) : (
              <div className="hidden md:flex gap-2">
                <Link className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/8 transition-all" href="/login">
                  Se connecter
                </Link>
                <Link className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 shadow-[0_0_16px_rgba(99,102,241,0.4)] transition-all" href="/register">
                  Commencer
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && token && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-3xl border-b border-white/10 shadow-2xl overflow-y-auto max-h-[85vh]">
          <div className="p-4 space-y-1">
            {navigationConfig.map(nav => {
              if (nav.type === 'link' && nav.href) {
                return (
                  <Link key={nav.href} href={nav.href} onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-white/80 hover:text-white transition-all">
                    <span className="text-white/40">{nav.icon}</span> {nav.label}
                  </Link>
                )
              }
              if (nav.type === 'dropdown' && nav.items) {
                const isSectionOpen = mobileSection === nav.label;
                return (
                  <div key={nav.label}>
                    <button type="button" onClick={() => setMobileSection(isSectionOpen ? null : nav.label)}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/5 text-white/80 transition-all">
                      <span className="flex items-center gap-3"><span className="text-white/40">{nav.icon}</span> {nav.label}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform ${isSectionOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    {isSectionOpen && (
                      <div className="ml-6 space-y-0.5 border-l border-white/8 pl-3">
                        {nav.items.map(item => (
                          <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 text-sm transition-all">
                            <span className="text-white/35">{item.icon}</span>{item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return null;
            })}

            <div className="h-px w-full bg-white/8 my-2" />
            <button type="button" onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium text-left">
              <span className="text-red-500/50">{I.Logout}</span> Déconnexion
            </button>
          </div>
        </div>
      )}

      <QuickAddTransaction
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent("nexledger-tx-added"));
        }}
      />
    </header>
  );
}
