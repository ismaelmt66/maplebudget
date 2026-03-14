"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatSession, getSessions, deleteSession, clearAllSessions, AI_NAME } from "@/lib/useChatHistory";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("fr-CA", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function duration(session: ChatSession) {
  const ms = session.endedAt - session.startedAt;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

// Basic markdown renderer (text only, no HTML)
function stripMarkdown(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/^### /gm, "").substring(0, 120);
}

export default function CoachHistoryPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  function handleDelete(id: string) {
    deleteSession(id);
    setSessions(getSessions());
    if (expanded === id) setExpanded(null);
  }

  function handleClearAll() {
    if (!confirm("Supprimer tout l'historique de conversations ? Cette action est irréversible.")) return;
    clearAllSessions();
    setSessions([]);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 pb-16 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/insights/coach" className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Retour à {AI_NAME}
            </Link>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Historique des conversations
          </h1>
          <p className="text-sm text-white/50 mt-2">
            {sessions.length === 0
              ? "Aucune session archivée pour l'instant."
              : `${sessions.length} session${sessions.length > 1 ? "s" : ""} archivée${sessions.length > 1 ? "s" : ""}`}
          </p>
        </div>

        {sessions.length > 0 && (
          <button
            onClick={handleClearAll}
            className="mb-btn gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30 shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
            Tout effacer
          </button>
        )}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="rounded-2xl p-14 text-center bg-black/30 border border-white/6">
          <div className="w-16 h-16 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 opacity-60">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold opacity-70">Aucun historique</h3>
          <p className="text-sm opacity-40 mt-2 max-w-sm mx-auto">
            Les conversations avec {AI_NAME} sont archivées automatiquement à la déconnexion.
          </p>
          <Link href="/insights/coach" className="mt-6 mb-btn mb-btn-primary inline-flex gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Démarrer une conversation
          </Link>
        </div>
      )}

      {/* Sessions list */}
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expanded === session.id;
          const userMsgCount = session.messages.filter((m) => m.role === "user").length;
          const lastMsg = [...session.messages].reverse().find((m) => m.role === "user");

          return (
            <div
              key={session.id}
              className="rounded-2xl bg-black/30 border border-white/6 overflow-hidden hover:border-white/10 transition-colors animate-fade-in-up"
            >
              {/* Session header */}
              <button
                onClick={() => setExpanded(isExpanded ? null : session.id)}
                className="w-full flex items-center gap-4 p-5 text-left"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{formatDate(session.startedAt)}</span>
                    <span className="text-xs opacity-40">·</span>
                    <span className="text-xs opacity-50">{duration(session)}</span>
                    <span className="text-xs opacity-40">·</span>
                    <span className="text-xs opacity-50">{userMsgCount} message{userMsgCount > 1 ? "s" : ""}</span>
                  </div>
                  {lastMsg && (
                    <p className="text-xs opacity-40 mt-1 truncate">
                      &ldquo;{stripMarkdown(lastMsg.content)}&rdquo;
                    </p>
                  )}
                </div>

                {/* Expand arrow */}
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`opacity-40 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Messages (expanded) */}
              {isExpanded && (
                <div className="border-t border-white/6 px-5 pb-5 pt-4 space-y-3 max-h-[500px] overflow-y-auto">
                  {session.messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-white/10 text-white rounded-br-sm"
                          : "bg-indigo-500/10 border border-indigo-500/20 text-white/80 rounded-bl-sm"
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</p>
                        <div className="mt-1 text-[10px] opacity-30 text-right">
                          {new Date(msg.ts).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Delete session */}
                  <div className="pt-3 flex justify-end">
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="text-xs text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                      </svg>
                      Supprimer cette session
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
