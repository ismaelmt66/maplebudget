"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendChatMessage, ApiError } from "@/lib/api";

type Message = {
    id: string;
    role: "user" | "ai";
    content: string;
    isTypingEffect?: boolean;
};

// Suggestions contextuelles
const SUGGESTIONS = [
    "Fais un bilan complet",
    "Où part mon argent ?",
    "Quels sont mes abonnements ?",
    "Comment épargner pour les vacances ?"
];

export default function CoachPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "ai",
            content: "Bonjour ! Je suis votre **Coach Financier IA (Moteur Heuristique)**. Je viens d'analyser vos dernières transactions, vos objectifs et votre patrimoine financier.\n\nQue souhaitez-vous explorer aujourd'hui ?",
            isTypingEffect: false
        }
    ]);
    const [input, setInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsThinking(true);

        try {
            const res = await sendChatMessage(userMsg.content);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "ai",
                content: res.reply,
                isTypingEffect: true // Active l'animation de frappe pour les nouveaux messages
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err: unknown) {
            if (err instanceof ApiError && err.status === 401) {
                router.push("/login");
            } else {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: "ai",
                    content: "Désolé, une erreur technique m'empêche de vous répondre. Veuillez réessayer plus tard.",
                    isTypingEffect: false
                }]);
            }
        } finally {
            setIsThinking(false);
        }
    };

    // Parseur Markdown basique étendu
    const renderMarkdown = (text: string) => {
        return text.split('\n').map((line, i) => {
            let processed = line;

            // Gras
            processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
            // Italique
            processed = processed.replace(/\*(.*?)\*/g, '<em class="text-white/90 italic">$1</em>');

            // Titres (###)
            if (processed.startsWith('### ')) {
                processed = `<h3 class="text-lg font-bold text-white mt-4 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300 w-fit">${processed.substring(4)}</h3>`;
            }
            // Listes
            else if (processed.trim().startsWith('- ')) {
                processed = `<li class="ml-5 list-disc marker:text-indigo-400 mb-1 pl-1">${processed.substring(2)}</li>`;
            }
            else if (processed.trim().match(/^\d+\.\s/)) {
                processed = `<li class="ml-5 list-decimal marker:text-indigo-400 mb-1 pl-1">${processed.replace(/^\d+\.\s/, '')}</li>`;
            }
            // Callouts (Alertes)
            else if (processed.trim().startsWith('> [!TIP]')) {
                processed = `<div class="mt-4 mb-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.1)]"><strong class="flex items-center gap-2 mb-1"><span class="text-xl">💡</span> Astuce</strong>`;
            } else if (processed.trim().startsWith('> [!WARNING]')) {
                processed = `<div class="mt-4 mb-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.1)]"><strong class="flex items-center gap-2 mb-1"><span class="text-xl">⚠️</span> Attention</strong>`;
            } else if (processed.trim().startsWith('> [!NOTE]')) {
                processed = `<div class="mt-4 mb-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.1)]"><strong class="flex items-center gap-2 mb-1"><span class="text-xl">ℹ️</span> Note</strong>`;
            }
            else if (processed.trim().startsWith('> ')) {
                processed = `<p class="mt-1 leading-relaxed">${processed.substring(2)}</p></div>`;
            }
            // Sauts de ligne
            else if (processed === '') {
                return <div key={i} className="h-2" />;
            }
            // Paragraphes normaux
            else {
                processed = `<p class="mb-2 leading-relaxed opacity-90">${processed}</p>`;
            }

            return <div key={i} dangerouslySetInnerHTML={{ __html: processed }} className="text-white/90" />;
        });
    };

    return (
        <main className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col pb-6 relative z-10">
            <header className="mb-6 flex items-center justify-between animate-fade-in-down">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                        Coach IA
                    </h1>
                    <p className="text-sm text-white/50 mt-1">
                        Moteur d&apos;Analyse Heuristique Avancé
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                    <div className={`w-3 h-3 rounded-full ${isThinking ? 'bg-purple-500 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`}></div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                        {isThinking ? 'Calculs en cours...' : 'Connecté à la BD'}
                    </span>
                </div>
            </header>

            {/* Chat Container */}
            <div className="flex-grow flex flex-col bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] relative">

                {/* Background ambient glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen -z-10" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen -z-10" />

                {/* Messages List Area */}
                <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                        >
                            <div className={`max-w-[90%] md:max-w-[80%] rounded-3xl p-6 ${msg.role === 'user'
                                ? 'bg-gradient-to-r from-white/90 to-white text-black rounded-br-sm shadow-xl font-medium'
                                : 'bg-black/60 border border-white/10 text-white rounded-bl-sm backdrop-blur-xl shadow-2xl relative'
                                }`}>

                                {msg.role === 'ai' && (
                                    <div className="absolute -left-2 -top-2 w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center border-2 border-[#121212] shadow-lg z-10">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                                    </div>
                                )}

                                {msg.role === 'ai' ? (
                                    <div className={`text-[15px] antialiased ${msg.isTypingEffect ? 'animate-typewriter' : ''}`}>
                                        {renderMarkdown(msg.content)}
                                    </div>
                                ) : (
                                    <p className="text-[15px] leading-relaxed">{msg.content}</p>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Loading Indicator */}
                    {isThinking && (
                        <div className="flex justify-start animate-fade-in-up mt-6">
                            <div className="bg-black/60 border border-white/10 backdrop-blur-xl rounded-full rounded-bl-sm px-5 py-4 shadow-xl flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-6 bg-black/60 border-t border-white/10 backdrop-blur-3xl relative z-20">

                    {/* Suggestions Pills */}
                    <div className="flex flex-wrap gap-2 mb-4 justify-center md:justify-start">
                        {SUGGESTIONS.map((sug, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSend(sug)}
                                disabled={isThinking}
                                className="px-4 py-2 rounded-full text-xs font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
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
                            placeholder="Posez une question à votre IA Financière..."
                            disabled={isThinking}
                            className="w-full bg-transparent px-6 py-5 text-[15px] text-white focus:outline-none placeholder:text-white/30 disabled:opacity-50"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isThinking}
                            title="Envoyer le message"
                            className="absolute right-2 w-12 h-12 flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white hover:brightness-110 disabled:opacity-50 disabled:grayscale transition-all shadow-[0_5px_15px_rgba(99,102,241,0.3)]"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="translate-x-0.5 mt-0.5">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
