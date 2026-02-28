"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { me } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "text-sm px-3 py-2 rounded-xl border transition",
        active
          ? "bg-white/10 border-white/15 text-white"
          : "bg-transparent border-transparent text-white/90 hover:bg-white/10 hover:border-white/15"
      )}
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
    <header className="sticky top-0 z-50">
      <div className="bg-[linear-gradient(135deg,rgb(var(--navy)),rgb(var(--navy-2)))] border-b border-white/10">
        {/* gold accent line */}
        <div className="h-[3px] bg-[rgb(var(--gold))]" />

        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center font-semibold text-white">
              M
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-white">MapleBudget</div>
              <div className="text-xs text-white/70">
                Digital Banking • Analytics • Planning
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/" label="Home" />
            <NavLink href="/dashboard" label="Dashboard" />
            <NavLink href="/transactions" label="Transactions" />
            <NavLink href="/goals" label="Goals" />
          </nav>

          <div className="flex items-center gap-2">
            {token ? (
              <>
                <span className="hidden sm:inline text-xs bg-white/10 border border-white/15 rounded-full px-3 py-1 text-white/80">
                  {email ? `Connecté: ${email}` : "Connecté"}
                </span>
                <Button variant="secondary" onClick={logout} className="bg-white/10 border-white/15 text-white hover:bg-white/15">
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="secondary" className="bg-white/10 border-white/15 text-white hover:bg-white/15">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" className="shadow-none">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* mobile nav */}
        <div className="md:hidden max-w-6xl mx-auto px-6 pb-4 flex gap-2 overflow-x-auto">
          <NavLink href="/" label="Home" />
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/transactions" label="Transactions" />
          <NavLink href="/goals" label="Goals" />
        </div>
      </div>
    </header>
  );
}