"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getToken } from "@/lib/auth";

export default function NexusWidget() {
  const [visible, setVisible] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  // Only show when logged in and not already on the coach page
  useEffect(() => {
    // delay visibility check slightly to avoid hydration mismatch and avoid synchronous setState
    const t = setTimeout(() => {
      const token = getToken();
      setVisible(!!token && pathname !== "/insights/coach");
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // Auto-open the bubble after 2 seconds, once per session
  useEffect(() => {
    if (!visible) return;
    const seen = sessionStorage.getItem("nexus_bubble_seen");
    if (seen) return;
    const t = setTimeout(() => {
      setBubbleOpen(true);
      sessionStorage.setItem("nexus_bubble_seen", "1");
    }, 2000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 select-none">

      {/* Speech bubble */}
      {bubbleOpen && (
        <div className="relative animate-fade-in-up">
          <div className="bg-[#0f0f1a]/95 border border-indigo-500/30 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(99,102,241,0.25)] max-w-[220px]">
            {/* Close x */}
            <button
              onClick={(e) => { e.stopPropagation(); setBubbleOpen(false); }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white/10 border border-white/10 text-white/50 hover:text-white flex items-center justify-center text-[10px] transition-all hover:bg-white/20"
              aria-label="Fermer"
            >✕</button>

            <p className="text-xs text-white/80 leading-relaxed font-medium">
              👋 Bonjour ! Je suis <span className="text-indigo-400 font-bold">Nexus</span>.<br />
              <span className="opacity-70">Comment puis-je vous aider aujourd&apos;hui ?</span>
            </p>

            <Link
              href="/insights/coach"
              className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Ouvrir Nexus
            </Link>
          </div>
          {/* Pointer triangle */}
          <div className="absolute -bottom-[7px] right-8 w-3.5 h-3.5 bg-[#0f0f1a] border-r border-b border-indigo-500/30 rotate-45" />
        </div>
      )}

      {/* The cute robot */}
      <div className="relative group">
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/60 border border-white/10 text-white/40 hover:text-white flex items-center justify-center text-[9px] z-10 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Masquer Nexus"
        >✕</button>

        <Link href="/insights/coach" onClick={() => setBubbleOpen(false)}>
          <div
            className="relative cursor-pointer"
            style={{ animation: "nexusFloat 3s ease-in-out infinite" }}
            onClick={() => setBubbleOpen((o) => !o)}
            role="button"
            aria-label="Parler à Nexus"
          >
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full bg-indigo-500/30 blur-xl scale-125 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

            {/* Robot SVG */}
            <div className="relative w-[62px] h-[62px] rounded-full bg-gradient-to-br from-[#1e1b4b] to-[#312e81] border-2 border-indigo-500/60 shadow-[0_0_24px_rgba(99,102,241,0.5)] flex items-center justify-center overflow-hidden group-hover:border-indigo-400 transition-all">
              <svg
                width="42"
                height="42"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Head */}
                <rect x="14" y="18" width="36" height="28" rx="8" fill="#4f46e5" />

                {/* Antenna */}
                <rect x="30" y="8" width="4" height="10" rx="2" fill="#818cf8" />
                <circle cx="32" cy="7" r="3.5" fill="#a5b4fc" />
                <circle cx="32" cy="7" r="1.5" fill="white" opacity="0.8" />

                {/* Eyes */}
                <rect x="19" y="26" width="10" height="8" rx="3" fill="#0ea5e9" opacity="0.9" />
                <rect x="35" y="26" width="10" height="8" rx="3" fill="#0ea5e9" opacity="0.9" />
                {/* Eye shine */}
                <circle cx="22" cy="28" r="2" fill="white" opacity="0.6" />
                <circle cx="38" cy="28" r="2" fill="white" opacity="0.6" />
                <circle cx="22" cy="28" r="1" fill="white" />
                <circle cx="38" cy="28" r="1" fill="white" />

                {/* Mouth */}
                <rect x="22" y="38" width="20" height="3" rx="1.5" fill="#818cf8" opacity="0.7" />
                {/* smile dots */}
                <circle cx="24" cy="39.5" r="1" fill="#c7d2fe" />
                <circle cx="40" cy="39.5" r="1" fill="#c7d2fe" />

                {/* Side panels */}
                <rect x="8" y="24" width="6" height="14" rx="3" fill="#3730a3" />
                <rect x="50" y="24" width="6" height="14" rx="3" fill="#3730a3" />
                <circle cx="11" cy="31" r="2" fill="#4f46e5" opacity="0.8" />
                <circle cx="53" cy="31" r="2" fill="#4f46e5" opacity="0.8" />

                {/* Body bottom */}
                <rect x="20" y="46" width="24" height="8" rx="4" fill="#3730a3" opacity="0.7" />
              </svg>

              {/* Status dot */}
              <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1e1b4b] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            </div>
          </div>
        </Link>
      </div>

      <style jsx global>{`
        @keyframes nexusFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
