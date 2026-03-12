"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { money } from "@/lib/format";

type Challenge = {
  id: string;
  title: string;
  description: string;
  target_amount: number;
  category: string | null;
  type: "reduce" | "save" | "behavior";
  reward: string;
};

type ChallengesData = {
  challenge: Challenge | null;
  all_challenges: Challenge[];
};

const typeConfig = {
  reduce: { icon: "✂️", color: "from-orange-500/20 to-red-500/10", border: "border-orange-500/20", badge: "bg-orange-500/20 text-orange-300" },
  save: { icon: "💰", color: "from-emerald-500/20 to-green-500/10", border: "border-emerald-500/20", badge: "bg-emerald-500/20 text-emerald-300" },
  behavior: { icon: "🧘", color: "from-violet-500/20 to-indigo-500/10", border: "border-violet-500/20", badge: "bg-violet-500/20 text-violet-300" },
};

export default function ChallengesPage() {
  const [data, setData] = useState<ChallengesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem("nexledger-challenges-accepted");
    return new Set(saved ? JSON.parse(saved) : []);
  });
  const [completed, setCompleted] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem("nexledger-challenges-completed");
    return new Set(saved ? JSON.parse(saved) : []);
  });

  useEffect(() => {
    apiFetch("/challenges/weekly")
      .then(d => setData(d as ChallengesData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function accept(id: string) {
    const next = new Set(accepted).add(id);
    setAccepted(next);
    localStorage.setItem("nexledger-challenges-accepted", JSON.stringify([...next]));
  }

  function complete(id: string) {
    const next = new Set(completed).add(id);
    setCompleted(next);
    localStorage.setItem("nexledger-challenges-completed", JSON.stringify([...next]));
  }

  const weekNum = Math.ceil((new Date().getDate()) / 7);
  const totalCompleted = completed.size;

  return (
    <main className="animate-fade-in-up max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Défis <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Financiers</span>
        </h1>
        <p className="text-white/50 mt-2 text-sm">Relevez des défis hebdomadaires personnalisés par Nexus pour améliorer vos habitudes.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-400">{totalCompleted}</div>
          <div className="text-xs text-white/40 mt-1">Défis complétés</div>
        </div>
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-fuchsia-400">{accepted.size}</div>
          <div className="text-xs text-white/40 mt-1">En cours</div>
        </div>
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-400">S{weekNum}</div>
          <div className="text-xs text-white/40 mt-1">Semaine actuelle</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-white/30 animate-pulse">Nexus analyse vos habitudes...</div>
      ) : !data?.all_challenges?.length ? (
        <div className="text-center py-16 text-white/40">Ajoutez des transactions pour débloquer des défis personnalisés.</div>
      ) : (
        <div className="space-y-5">
          {/* Défi de la semaine */}
          {data.challenge && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-violet-400">⭐ Défi de la semaine</span>
              </div>
              <ChallengeCard
                challenge={data.challenge}
                featured
                accepted={accepted.has(data.challenge.id)}
                completed={completed.has(data.challenge.id)}
                onAccept={() => accept(data.challenge!.id)}
                onComplete={() => complete(data.challenge!.id)}
              />
            </div>
          )}

          {/* Tous les défis */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">Tous les défis disponibles</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data.all_challenges.map(c => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  accepted={accepted.has(c.id)}
                  completed={completed.has(c.id)}
                  onAccept={() => accept(c.id)}
                  onComplete={() => complete(c.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ChallengeCard({
  challenge, featured = false, accepted, completed, onAccept, onComplete,
}: {
  challenge: Challenge;
  featured?: boolean;
  accepted: boolean;
  completed: boolean;
  onAccept: () => void;
  onComplete: () => void;
}) {
  const cfg = typeConfig[challenge.type] ?? typeConfig.behavior;

  return (
    <div className={`bg-gradient-to-br ${cfg.color} ${cfg.border} border rounded-2xl p-5 ${featured ? "ring-1 ring-violet-500/30" : ""} relative overflow-hidden`}>
      {completed && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
          <div className="text-center">
            <div className="text-4xl mb-2">🏆</div>
            <div className="text-white font-bold text-lg">Défi Complété !</div>
            <div className="text-white/60 text-sm mt-1">{challenge.reward}</div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{cfg.icon}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
          {challenge.type === "reduce" ? "Réduction" : challenge.type === "save" ? "Épargne" : "Comportement"}
        </span>
      </div>

      <h3 className="text-base font-bold text-white mb-1">{challenge.title}</h3>
      <p className="text-sm text-white/60 leading-relaxed mb-4">{challenge.description}</p>

      {challenge.target_amount > 0 && (
        <div className="flex items-center gap-2 mb-4 bg-black/20 rounded-xl px-3 py-2">
          <span className="text-xs text-white/50">Objectif</span>
          <span className="text-sm font-bold text-white">{money(challenge.target_amount)}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="text-xs text-white/40 flex items-center gap-1 flex-1">
          🎖️ <span>{challenge.reward}</span>
        </div>
        {!accepted && !completed ? (
          <button
            onClick={onAccept}
            className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(139,92,246,0.4)]"
          >
            Relever le défi
          </button>
        ) : accepted && !completed ? (
          <button
            onClick={onComplete}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)]"
          >
            Marquer complété ✓
          </button>
        ) : null}
      </div>
    </div>
  );
}
