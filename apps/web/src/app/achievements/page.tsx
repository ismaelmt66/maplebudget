"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, Achievement, getAchievements } from "@/lib/api";

export default function AchievementsPage() {
    const router = useRouter();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setErr(null);
                const data = await getAchievements();
                setAchievements(data);
            } catch (e: any) {
                if (e instanceof ApiError && e.status === 401) {
                    router.push("/login");
                } else {
                    setErr(e.message || "Failed to load achievements");
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

    return (
        <main className="max-w-5xl mx-auto space-y-10 pb-16">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Trophées</h1>
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
