/**
 * useChatHistory - Persistent chat history for Nexus AI.
 *
 * Active session: stored under nexus_chat_<email>
 * Archived sessions: stored under nexus_sessions (array of ChatSession)
 *
 * On logout, the active session is archived instead of deleted.
 * Sessions are viewable even after logout via the history page.
 */

import { useState, useEffect, useCallback } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  ts: number;
};

export type ChatSession = {
  id: string;          // unique session id
  email: string;       // user email (masked after logout)
  startedAt: number;   // unix ms
  endedAt: number;     // unix ms (0 = still active)
  messages: ChatMessage[];
};

export const AI_NAME = "Nexus";

const ARCHIVE_KEY = "nexus_sessions";
const MAX_SESSIONS = 50; // keep last 50 sessions

function activeKey(email: string) {
  return `nexus_chat_${email}`;
}

const WELCOME_MESSAGE = (ts = Date.now()): ChatMessage => ({
  id: "welcome",
  role: "ai",
  content: `Bonjour ! Je suis **${AI_NAME}**, votre assistant financier intelligent.\n\nJ'ai analysé vos transactions, vos objectifs et votre patrimoine. Comment puis-je vous aider aujourd'hui ?`,
  ts,
});

// ---------- Session archive helpers ----------

export function getSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as ChatSession[]).sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

/**
 * Archive the current active session and clear it.
 * Call this on logout instead of simply deleting.
 */
export function archiveChatHistory(email: string | null) {
  if (!email) return;
  const key = activeKey(email);
  const raw = localStorage.getItem(key);
  if (!raw) return;

  try {
    const messages: ChatMessage[] = JSON.parse(raw);
    // Only archive if there's at least one real message (beyond welcome)
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    const session: ChatSession = {
      id: `session_${Date.now()}`,
      email,
      startedAt: messages[0]?.ts ?? Date.now(),
      endedAt: Date.now(),
      messages,
    };
    const existing = getSessions();
    saveSessions([session, ...existing]);
  } catch {
    // ignore parse errors
  }
  localStorage.removeItem(key);
}

/** Delete a specific archived session by id */
export function deleteSession(id: string) {
  const sessions = getSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
}

/** Clear ALL archived sessions */
export function clearAllSessions() {
  localStorage.removeItem(ARCHIVE_KEY);
}

// ---------- Hook ----------

export function useChatHistory(email: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE()]);

  // Load active session from localStorage when email is known
  useEffect(() => {
    if (!email) return; // delay storage read slightly to avoid React hydration mismatch and avoid synchronous setState
    const storageKey = activeKey(email);
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved: ChatMessage[] = JSON.parse(raw);
          if (saved.length > 0) {
            setMessages(saved);
            return;
          }
        }
      } catch { /* corrupt */ }

      // if nothing saved, display the default welcome message
      setMessages([WELCOME_MESSAGE()]);
    }, 0);
    return () => clearTimeout(t);
  }, [email]);

  // Auto-save active session on every change
  useEffect(() => {
    if (!email) return;
    localStorage.setItem(activeKey(email), JSON.stringify(messages));
  }, [email, messages]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    if (email) localStorage.removeItem(activeKey(email));
    setMessages([WELCOME_MESSAGE()]);
  }, [email]);

  return { messages, addMessage, clearMessages };
}
