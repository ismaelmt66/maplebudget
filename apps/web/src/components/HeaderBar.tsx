"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";
import { me } from "@/lib/api";

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-sm px-3 py-2 rounded-lg border border-transparent hover:border-black/10 hover:bg-black/5 transition"
    >
      {label}
    </Link>
  );
}

export default function HeaderBar() {
  const [token, setTokenState] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    setTokenState(t);

    if (t) {
      me()
        .then((u) => setEmail(u.email))
        .catch(() => {
          // token invalide
          clearToken();
          setTokenState(null);
          setEmail(null);
        });
    }
  }, []);

  function logout() {
    clearToken();
    setTokenState(null);
    setEmail(null);
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border flex items-center justify-center font-semibold">
            M
          </div>
          <div className="leading-tight">
            <div className="font-semibold">MapleBudget</div>
            <div className="text-xs opacity-70">
              Budget • Goals • Credit (educational)
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <NavItem href="/" label="Home" />
          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/goals" label="Goals" />
          <NavItem href="/transactions" label="Transactions" />
        </nav>

        <div className="flex items-center gap-2">
          {token ? (
            <>
              <span className="hidden sm:inline text-xs border rounded-full px-2 py-1 opacity-70">
                {email ? `Connecté: ${email}` : "Connecté"}
              </span>
              <button
                onClick={logout}
                className="text-sm px-3 py-2 rounded-lg border hover:bg-black/5 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm px-3 py-2 rounded-lg border hover:bg-black/5 transition"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-sm px-3 py-2 rounded-lg border hover:bg-black/5 transition"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}