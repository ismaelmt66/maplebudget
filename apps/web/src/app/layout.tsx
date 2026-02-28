import "./globals.css";
import HeaderBar from "@/components/HeaderBar";

export const metadata = {
  title: "MapleBudget",
  description: "Newcomer Finance & Credit Planner (educational)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bank-mesh">
        <HeaderBar />
        <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>

        <footer className="mt-14">
          <div className="max-w-6xl mx-auto px-6 pb-10">
            <div className="rounded-3xl border bg-[rgb(var(--surface))] px-6 py-5 text-sm text-[rgb(var(--muted))] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                MapleBudget — portfolio “institution-style”. Données locales en dev.
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs border rounded-full px-3 py-1">Next.js</span>
                <span className="text-xs border rounded-full px-3 py-1">FastAPI</span>
                <span className="text-xs border rounded-full px-3 py-1">SQLite</span>
                <span className="text-xs border rounded-full px-3 py-1">JWT Auth</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}