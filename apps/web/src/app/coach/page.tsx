"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendChatMessage, getAIStatus, AIStatus, ApiError, me } from "@/lib/api";
import { useChatHistory, AI_NAME, ChatMessage } from "@/lib/useChatHistory";

// Contextuelles suggestions
const SUGGESTIONS = [
  "Fais un bilan complet",
  "Où part mon argent ?",
  "Quels sont mes abonnements ?",
  "Comment épargner pour les vacances ?",
];

// Basic extended Markdown renderer
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    let html = line;
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="text-white/90 italic">$1</em>');

    if (html.startsWith("### ")) {
      html = `<h3 class="text-lg font-bold text-white mt-4 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300 w-fit">${html.substring(4)}</h3>`;
    } else if (html.trim().startsWith("- ")) {
      html = `<li class="ml-5 list-disc marker:text-indigo-400 mb-1 pl-1">${html.substring(2)}</li>`;
    } else if (html.trim().match(/^\d+\.\s/)) {
      html = `<li class="ml-5 list-decimal marker:text-indigo-400 mb-1 pl-1">${html.replace(/^\d+\.\s/, "")}</li>`;
    } else if (html.trim().startsWith("> [!TIP]")) {
      html = `<div class="mt-3 mb-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-100"><strong class="flex items-center gap-2 mb-1"><span>💡</span> Astuce</strong>`;
    } else if (html.trim().startsWith("> [!WARNING]")) {
      html = `<div class="mt-3 mb-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-100"><strong class="flex items-center gap-2 mb-1"><span>⚠️</span> Attention</strong>`;
    } else if (html.trim().startsWith("> [!NOTE]")) {
      html = `<div class="mt-3 mb-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-100"><strong class="flex items-center gap-2 mb-1"><span>ℹ️</span> Note</strong>`;
    } else if (html.trim().startsWith("> ")) {
      html = `<p class="mt-1 leading-relaxed">${html.substring(2)}</p></div>`;
    } else if (html === "") {
      return <div key={i} className="h-2" />;
    } else {
      html = `<p class="mb-2 leading-relaxed opacity-90">${html}</p>`;
    }

    return <div key={i} dangerouslySetInnerHTML={{ __html: html }} className="text-white/90" />;
  });
}

export default function CoachPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persistent chat history
  const { messages, addMessage, clearMessages } = useChatHistory(email);

  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  // Fetch authenticated user email and AI status
  useEffect(() => {
    me()
      .then((u) => setEmail(u.email))
      .catch(() => router.push("/login"));
      
    getAIStatus().then(setAiStatus).catch(() => {});
  }, [router]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text, ts: Date.now() };
    addMessage(userMsg);
    setInput("");
    setIsThinking(true);

    try {
      const history = messages
        .filter(m => m.id !== "welcome")
        .map(m => ({ role: m.role, content: m.content }));
        
      const res = await sendChatMessage(text, history);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: res.reply,
        ts: Date.now(),
      };
      addMessage(aiMsg);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
      } else {
        addMessage({
          id: Date.now().toString(),
          role: "ai",
          content: "Désolé, une erreur technique m'empêche de vous répondre. Veuillez réessayer plus tard.",
          ts: Date.now(),
        });
      }
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col pb-6 relative z-10">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between animate-fade-in-down">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            {AI_NAME}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Assistant Financier Intelligent
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* History link */}
          <Link
            href="/coach/history"
            title="Voir l'historique des conversations"
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-indigo-400 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </Link>

          {/* AI Mode badge */}
          {aiStatus && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md shadow-lg ${
                aiStatus.mode === "llm"
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
              title={
                aiStatus.mode === "llm"
                  ? `Propulsé par ${aiStatus.llm_provider === "groq" ? "Llama 3 (Groq)" : "Claude (Anthropic)"}`
                  : "Mode Heuristique (Aucune clé API LLM détectée)"
              }
            >
              {aiStatus.mode === "llm" ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Mode IA
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Mode Heuristique
                </>
              )}
            </div>
          )}

          {/* Status badge */}
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <div className={`w-2.5 h-2.5 rounded-full ${isThinking ? "bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {isThinking ? "Analyse…" : "En ligne"}
            </span>
          </div>

          {/* Clear button */}
          <button
            onClick={clearMessages}
            title="Réinitialiser la conversation"
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Chat window */}
      <div className="flex-grow flex flex-col bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] relative">
        {/* Ambient glows */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/8 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/8 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Messages list */}
        <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
            >
              <div className={`max-w-[90%] md:max-w-[80%] rounded-3xl p-6 ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-white/90 to-white text-black rounded-br-sm shadow-xl font-medium"
                  : "bg-black/60 border border-white/10 text-white rounded-bl-sm backdrop-blur-xl shadow-2xl relative"
              }`}>
                {msg.role === "ai" && (
                  <div className="absolute -left-2 -top-2 w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center border-2 border-[#121212] shadow-lg z-10">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                )}
                <div className="text-[15px] antialiased">
                  {msg.role === "ai" ? renderMarkdown(msg.content) : <p className="leading-relaxed">{msg.content}</p>}
                </div>
                <div className="mt-2 text-[11px] opacity-30 text-right">
                  {new Date(msg.ts).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="flex justify-start animate-fade-in-up">
              <div className="bg-black/60 border border-white/10 backdrop-blur-xl rounded-full rounded-bl-sm px-5 py-4 shadow-xl flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input area */}
        <div className="p-4 md:p-6 bg-black/60 border-t border-white/10 backdrop-blur-3xl relative z-20">
          {/* Suggestion pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sug)}
                disabled={isThinking}
                className="px-4 py-1.5 rounded-full text-xs font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/30 transition-all disabled:opacity-40"
              >
                {sug}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="relative flex items-center bg-[#1a1a1a]/80 backdrop-blur-md rounded-2xl border border-white/10 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-inner"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Posez une question à ${AI_NAME}…`}
              disabled={isThinking}
              className="w-full bg-transparent px-6 py-5 text-[15px] text-white focus:outline-none placeholder:text-white/30 disabled:opacity-50"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              title="Envoyer"
              className="absolute right-2 w-12 h-12 flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white hover:brightness-110 disabled:opacity-40 disabled:grayscale transition-all shadow-[0_5px_15px_rgba(99,102,241,0.3)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="translate-x-0.5 mt-0.5">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
