import type { Metadata } from "next";
import "./globals.css";
import HeaderBar from "@/components/HeaderBar";

export const metadata: Metadata = {
  title: "MapleBudget — Portfolio FinTech",
  description: "Budget & Analytics (educational).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <HeaderBar />

        <div className="mb-container">
          {children}

          <footer className="mt-14 text-xs opacity-60">
            MapleBudget — portfolio FinTech (educational). Next.js + FastAPI.
          </footer>
        </div>

        {/* Subtle floating shapes (light + stable) */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="mb-float"
            style={{
              position: "absolute",
              left: "7%",
              top: "8%",
              width: 420,
              height: 420,
              filter: "blur(48px)",
              background: "radial-gradient(circle at 30% 30%, rgba(96,165,250,0.20), transparent 60%)",
            }}
          />
          <div
            className="mb-float"
            style={{
              position: "absolute",
              right: "8%",
              top: "12%",
              width: 360,
              height: 360,
              filter: "blur(48px)",
              background: "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.16), transparent 60%)",
              animationDelay: "1.4s",
            }}
          />
        </div>
      </body>
    </html>
  );
}