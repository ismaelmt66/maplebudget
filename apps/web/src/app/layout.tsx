import type { Metadata } from "next";
import "./globals.css";
import HeaderBar from "@/components/HeaderBar";
import { ToastProvider } from "@/components/ui/Toast";
import NexusWidget from "@/components/NexusWidget";

export const metadata: Metadata = {
  title: "NexLedger - Portfolio FinTech",
  description: "Budget & Analytics (educational).",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NexLedger",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="theme-color" content="#7c3aed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <ToastProvider>
          <HeaderBar />

          <div className="mb-container">
            {children}

            <footer className="mt-14 text-xs opacity-60">
              NexLedger - portfolio FinTech (educational). Next.js + FastAPI.
            </footer>
          </div>
          <NexusWidget />
        </ToastProvider>
      </body>
    </html>
  );
}
