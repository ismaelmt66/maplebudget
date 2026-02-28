import "./globals.css";
import HeaderBar from "@/components/HeaderBar";

export const metadata = {
  title: "MapleBudget",
  description: "Newcomer Finance & Credit Planner (educational)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-black antialiased">
        <HeaderBar />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t mt-12">
          <div className="max-w-6xl mx-auto px-6 py-8 text-sm opacity-70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>MapleBudget — projet portfolio (educational). Données locales en dev.</div>
            <div className="flex items-center gap-3">
              <span className="text-xs border rounded-full px-2 py-1">Next.js</span>
              <span className="text-xs border rounded-full px-2 py-1">FastAPI</span>
              <span className="text-xs border rounded-full px-2 py-1">SQLite</span>
              <span className="text-xs border rounded-full px-2 py-1">Auth (JWT)</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}