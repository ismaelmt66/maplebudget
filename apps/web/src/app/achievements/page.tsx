"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, Achievement, apiFetch } from "@/lib/api";

type AchievementsResponse = {
    achievements: Achievement[];
    xp: number;
    level: string;
    level_progress: number;
};

const LEVEL_CONFIG: Record<string, { min: number; max: number; color: string; gradient: string }> = {
    "Débutant": { min: 0, max: 200, color: "text-zinc-400", gradient: "from-zinc-500 to-zinc-300" },
    "Apprenti": { min: 200, max: 400, color: "text-blue-400", gradient: "from-blue-500 to-cyan-300" },
    "Expert": { min: 400, max: 700, color: "text-purple-400", gradient: "from-purple-500 to-pink-300" },
    "Maître": { min: 700, max: 1000, color: "text-amber-400", gradient: "from-amber-500 to-yellow-300" },
    "Gourou": { min: 1000, max: 1200, color: "text-emerald-400", gradient: "from-emerald-500 to-green-300" },
};

export default function AchievementsPage() {
    const router = useRouter();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [xp, setXp] = useState(0);
    const [level, setLevel] = useState("Débutant");
    const [levelProgress, setLevelProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setErr(null);
                const data = await apiFetch("/achievements") as AchievementsResponse;
                setAchievements(data.achievements);
                setXp(data.xp);
                setLevel(data.level);
                setLevelProgress(data.level_progress);
            } catch (e: unknown) {
                if (e instanceof ApiError && e.status === 401) {
                    router.push("/login");
                } else {
                    setErr((e as Error).message || "Failed to load achievements");
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [router]);

    const unlockedCount = achievements.filter(a => a.is_unlocked).length;
    const totalCount = achievements.length;
    const progress = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

    const lvlConfig = LEVEL_CONFIG[level] ?? LEVEL_CONFIG["Débutant"];

    return (
        <main className="max-w-5xl mx-auto px-4 space-y-6 pb-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trophées</h1>
                    <p className="text-sm opacity-70 mt-3">
                        Accomplis des objectifs financiers pour débloquer des badges exclusifs.
                    </p>
                </div>
                {!loading && (
                    <div className="text-left md:text-right">
                        <span className="text-sm uppercase tracking-widest opacity-60 font-bold mb-1 block">Progression</span>
                        <div className="flex items-center md:justify-end gap-4">
                            <div className="text-3xl md:text-4xl font-black text-white">{unlockedCount} / {totalCount}</div>
                        </div>
                    </div>
                )}
            </header>

            {/* Level + XP Card */}
            {!loading && (
                <div className="animate-fade-in-up delay-100">
                    <div className="relative overflow-hidden rounded-[2rem] p-8 bg-black/40 border border-white/10 backdrop-blur-xl">
                        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                            {/* Level Badge */}
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${lvlConfig.gradient} flex items-center justify-center shadow-lg`}>
                                    <span className="text-2xl font-black text-white drop-shadow-md">
                                        {level === "Gourou" ? "💎" : level === "Maître" ? "★" : level === "Expert" ? "◆" : level === "Apprenti" ? "▲" : "●"}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-widest opacity-60 font-bold">Niveau</div>
                                    <div className={`text-2xl font-black ${lvlConfig.color}`}>{level}</div>
                                </div>
                            </div>

                            {/* XP Bar */}
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-2">
                                    <span className="text-sm font-bold opacity-80">{xp} XP</span>
                                    <span className="text-xs opacity-50">
                                        {level === "Gourou"
                                            ? "Niveau maximum atteint !"
                                            : `${lvlConfig.max - xp} XP pour le prochain niveau`}
                                    </span>
                                </div>
                                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative shadow-inner">
                                    <div
                                        className={`h-full bg-gradient-to-r ${lvlConfig.gradient} transition-all duration-1000 ease-out rounded-full`}
                                        style={{
                                            width: `${Math.max(levelProgress * 100, 2)}%`,
                                            boxShadow: `0 0 15px rgba(251,191,36,0.3)`,
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs opacity-40 mt-1.5 font-mono">
                                    <span>{lvlConfig.min} XP</span>
                                    <span>{level === "Gourou" ? "∞" : `${lvlConfig.max} XP`}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Progress Bar */}
            {!loading && (
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden relative shadow-inner">
                    <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(251,191,36,0.5)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {err && (
                <div className="rounded-3xl p-6 bg-red-500/10 border border-red-500/30 text-red-200 animate-fade-in-up">
                    {err}
                </div>
            )}

            {loading ? (
                <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-white/5 rounded-[2rem] border border-white/10"></div>
                    ))}
                </div>
            ) : (
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in-up delay-100">
                    {achievements.map((acc, idx) => (
                        <div
                            key={acc.id}
                            className={`relative group overflow-hidden rounded-[2.5rem] p-8 transition-all duration-500 ${acc.is_unlocked
                                    ? "bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/30 shadow-[0_20px_40px_-15px_rgba(251,191,36,0.15)] hover:scale-[1.02] hover:shadow-[0_30px_60px_-15px_rgba(251,191,36,0.3)]"
                                    : "bg-black/40 border border-white/5 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                                } backdrop-blur-xl`}
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-500" />

                            <div className="flex flex-col items-center text-center h-full relative z-10">
                                <div className={`text-6xl mb-6 transition-transform duration-500 group-hover:scale-110 ${acc.is_unlocked ? 'drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]' : 'opacity-40'}`}>
                                    {acc.icon}
                                </div>

                                <h3 className={`text-xl font-bold mb-2 ${acc.is_unlocked ? 'text-amber-300 drop-shadow-md' : 'text-white'}`}>
                                    {acc.title}
                                </h3>

                                <p className="text-sm opacity-70 mb-6 flex-grow">
                                    {acc.description}
                                </p>

                                <div className="w-full mt-auto">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-60 mb-2">
                                        <span>Progression</span>
                                        <span>{Math.round(acc.progress * 100)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className={`h-full transition-all duration-1000 ease-out ${acc.is_unlocked ? 'bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-white/20'}`}
                                            style={{ width: `${acc.progress * 100}%` }}
                                        />
                                    </div>
                                    {acc.is_unlocked && (
                                        <div className="mt-4 text-xs font-bold text-amber-500/80 bg-amber-500/10 py-1.5 px-3 rounded-full inline-block border border-amber-500/20">
                                            Débloqué
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </section>
            )}
        </main>
    );
}
