"use client";

import { useEffect, useRef, useState } from "react";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from "@/lib/api";
import { getToken } from "@/lib/auth";

const typeColors: Record<string, string> = {
  alert: "text-red-400",
  anomaly: "text-orange-400",
  goal: "text-emerald-400",
  tip: "text-violet-400",
  weekly: "text-indigo-400",
};

const typeIcons: Record<string, string> = {
  alert: "⚠️",
  anomaly: "🔍",
  goal: "🎯",
  tip: "💡",
  weekly: "📅",
};

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getNotifications();
        if (active) setNotifs(data);
      } catch {
        // Ignore notification fetch errors to avoid breaking the menu
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Fermer en cliquant ailleurs
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleMarkRead(id: number) {
    await markNotificationRead(id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-10 h-10 flex items-center justify-center rounded-[14px] text-white/60 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(139,92,246,0.8)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-full right-0 mt-3 w-80 rounded-2xl bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_20px_rgba(139,92,246,0.15)] overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Notifications Nexus</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Tout lire
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-white/40 text-sm">Chargement...</div>
            ) : notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <span className="text-2xl">🔕</span>
                <span className="text-sm text-white/40">Aucune notification</span>
              </div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3 ${n.is_read ? "opacity-50" : ""}`}
                >
                  <span className="text-lg mt-0.5 flex-shrink-0">{typeIcons[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${typeColors[n.type] ?? "text-white"}`}>
                      {n.title}
                    </div>
                    <div className="text-xs text-white/60 mt-0.5 leading-snug line-clamp-2">{n.body}</div>
                    <div className="text-[10px] text-white/30 mt-1">{n.created_at.slice(0, 10)}</div>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5 flex-shrink-0 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
