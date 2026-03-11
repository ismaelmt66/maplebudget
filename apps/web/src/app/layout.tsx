import type { Metadata } from "next";
import "./globals.css";
import HeaderBar from "@/components/HeaderBar";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "NexLedger - Portfolio FinTech",
  description: "Budget & Analytics (educational).",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>
          <HeaderBar />

          <div className="mb-container">
            {children}

            <footer className="mt-14 text-xs opacity-60">
              NexLedger - portfolio FinTech (educational). Next.js + FastAPI.
            </footer>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
