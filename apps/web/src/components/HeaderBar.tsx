"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";
import { me } from "@/lib/api";

function NavLink({ href, label }: { href: string; label: string }) {
  const p = usePathname();
  const active = p === href || (href !== "/" && p.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "px-3 py-2 rounded-xl text-sm border transition",
        active
          ? "bg-white/[0.10] border-white/20"
          : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function HeaderBar() {
  const [hidden, setHidden] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const lastY = useRef(0);
  const ticking = useRef(false);

  // Auth state
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

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;

        // ignore tiny scrolls
        if (Math.abs(delta) > 8) {
          if (delta > 0 && y > 80) setHidden(true); // scrolling down
          if (delta < 0) setHidden(false);          // scrolling up
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
        "sticky top-0 z-50 transition-transform duration-200",
        hidden ? "-translate-y-[110%]" : "translate-y-0",
      ].join(" ")}
    >
      <div className="border-b border-white/10 bg-black/20" style={{ backdropFilter: "blur(10px)" }}>
        <div className="mb-container flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(99,102,241,0.22))",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
              }}
            />
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">MapleBudget</div>
              <div className="text-xs opacity-70">Bank-grade UI • Portfolio</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLink href="/" label="Home" />
            <NavLink href="/dashboard" label="Dashboard" />
            <NavLink href="/transactions" label="Transactions" />
            <NavLink href="/goals" label="Goals" />
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-2">
            {token ? (
              <>
                <span className="hidden lg:inline mb-badge">
                  {email ? `Connecté: ${email}` : "Connecté"}
                </span>
                <button className="mb-btn" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link className="mb-btn" href="/login">
                  Se connecter
                </Link>
                <Link className="mb-btn mb-btn-primary" href="/register">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="mb-container md:hidden pt-0 pb-4">
          <div className="flex gap-2 overflow-x-auto">
            <NavLink href="/" label="Home" />
            <NavLink href="/dashboard" label="Dashboard" />
            <NavLink href="/transactions" label="Transactions" />
            <NavLink href="/goals" label="Goals" />
          </div>
        </div>
      </div>
    </header>
  );
}