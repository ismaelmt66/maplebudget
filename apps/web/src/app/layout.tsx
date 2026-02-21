import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "MapleBudget",
  description: "Newcomer Finance & Credit Planner (educational)",
};

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-black antialiased">
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
              <NavItem href="/transactions" label="Transactions" />
            </nav>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs border rounded-full px-2 py-1 opacity-70">
                Local Dev
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>

        <footer className="border-t mt-12">
          <div className="max-w-6xl mx-auto px-6 py-8 text-sm opacity-70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              MapleBudget — projet portfolio (educational). Données locales en dev.
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs border rounded-full px-2 py-1">
                Next.js
              </span>
              <span className="text-xs border rounded-full px-2 py-1">
                FastAPI
              </span>
              <span className="text-xs border rounded-full px-2 py-1">
                SQLite
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}