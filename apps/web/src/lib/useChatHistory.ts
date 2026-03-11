/**
 * useChatHistory - Persistent chat history hook for Nexus AI.
 *
 * Messages are stored in localStorage under a key based on the user email,
 * so conversations survive page navigation but are isolated per user.
 *
 * Call clearChatHistory(email) on logout to wipe the stored messages.
 */

import { useState, useEffect, useCallback } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  ts: number; // Unix timestamp ms
};

const AI_NAME = "Nexus";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "ai",
  content: `Bonjour ! Je suis **${AI_NAME}**, votre assistant financier intelligent.\n\nJ'ai analysé vos transactions, vos objectifs et votre patrimoine. Comment puis-je vous aider aujourd'hui ?`,
  ts: Date.now(),
};

function storageKey(email: string) {
  return `nexus_chat_${email}`;
}

/** Wipe the chat history for a given user. Call this on logout. */
export function clearChatHistory(email: string | null) {
  if (!email) {
    // Clear ALL nexus_chat_* keys when email is unknown
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("nexus_chat_"));
    keys.forEach((k) => localStorage.removeItem(k));
  } else {
    localStorage.removeItem(storageKey(email));
  }
}

/** Hook: returns [messages, addMessage, clearMessages] */
export function useChatHistory(email: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);

  // Load from localStorage on mount / when email changes
  useEffect(() => {
    if (!email) return;
    const key = storageKey(email);
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const saved: ChatMessage[] = JSON.parse(raw);
        if (saved.length > 0) {
          setMessages(saved);
          return;
        }
      } catch {
        // corrupt data – reset
      }
    }
    // First visit or cleared history
    setMessages([WELCOME_MESSAGE]);
  }, [email]);

  // Persist to localStorage whenever messages change
  useEffect(() => {
    if (!email) return;
    const key = storageKey(email);
    localStorage.setItem(key, JSON.stringify(messages));
  }, [email, messages]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    if (email) localStorage.removeItem(storageKey(email));
    setMessages([WELCOME_MESSAGE]);
  }, [email]);

  return { messages, addMessage, clearMessages };
}

export { AI_NAME };
