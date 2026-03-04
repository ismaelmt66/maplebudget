"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { me } from "@/lib/api";

const FINANCE_STREAM = [
  { title: "Rythme > magie", text: "Les vrais progrès viennent d’habitudes simples et régulières." },
  { title: "Net négatif", text: "Ajuste d’abord le variable avant de toucher au nécessaire." },
  { title: "Budget = liberté", text: "Un budget n’est pas une restriction, c’est un plan." },
  { title: "Coussin d’urgence", text: "1 mois, puis 3 mois, puis 6 mois de dépenses." },
] as const;

export default function HomePage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await me();
        setAuthed(true);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  return (
    <main className="w-full overflow-hidden pb-20">

      {/* BACKGROUND GLOWS FOR HERO */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

      {/* 1. HERO SECTION */}
      <section className="relative pt-20 pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left Text */}
          <div className="space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm font-medium text-blue-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              FinTech Nouvelle Génération
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Maîtrisez votre <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                Avenir Financier
              </span>
            </h1>

            <p className="text-lg opacity-70 max-w-xl leading-relaxed">
              Vos budgets, analyses, objectifs et transactions réunis dans une interface
              minimaliste de classe mondiale. Reprenez le contrôle dès aujourd'hui sans complexité.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href={authed ? "/dashboard" : "/register"}
                className="px-8 py-4 rounded-xl bg-white text-black font-semibold shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] transition-all transform hover:-translate-y-1"
              >
                {authed ? "Ouvrir l'App" : "Démarrer gratuitement"}
              </Link>
              {!authed && (
                <Link
                  href="/login"
                  className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  Se connecter
                </Link>
              )}
            </div>

            <div className="flex items-center gap-4 pt-6 opacity-50 text-sm">
              <div className="w-10 h-px bg-white/30" />
              <p>Sécurisé • Open-Source • Rapide</p>
            </div>
          </div>

          {/* Right Floating Mockup (Pure CSS) */}
          <div className="hidden lg:block mockup-container w-full h-full relative delay-200 animate-fade-in-up">
            <div className="animate-float-mockup absolute inset-0 right-[-10%] top-[10%]">

              {/* Fake App Glass Window */}
              <div className="w-[110%] h-[500px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-border-glow">
                {/* Fake Header */}
                <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                    <div className="w-3 h-3 rounded-full bg-green-400/80" />
                  </div>
                  <div className="ml-auto flex gap-4 text-[10px] font-semibold tracking-wider text-white/40">
                    <div>ANALYTIQUE</div>
                    <div>TRANSACTIONS</div>
                  </div>
                </div>

                {/* Fake Body */}
                <div className="p-6 flex-1 flex flex-col gap-6 relative overflow-hidden">
                  {/* Background grid */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

                  {/* KPI Row */}
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">Revenus d'Avril</div>
                      <div className="text-2xl font-bold text-green-400">+ 4 250 $</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">Dépenses d'Avril</div>
                      <div className="text-2xl font-bold text-red-400">- 1 120 $</div>
                    </div>
                  </div>

                  {/* Graph Row */}
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 relative z-10 flex items-end gap-3 justify-center">
                    {[40, 70, 45, 90, 60, 100, 30].map((h, i) => (
                      <div key={i} className="w-8 rounded-t-sm" style={{ height: `${h}%`, background: h > 80 ? 'rgba(99,102,241,0.8)' : 'rgba(96,165,250,0.5)' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. BENTO FEATURES GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
        <div className="text-center mb-16 animate-fade-in-up delay-100">
          <h2 className="text-3xl md:text-4xl font-bold">Un écosystème taillé pour la <span className="text-blue-400">performance</span>.</h2>
          <p className="mt-4 opacity-70 max-w-2xl mx-auto">Chaque pixel a été pensé pour vous faire gagner du temps et vous offrir une visibilité instantanée sur l'état de vos finances.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">

          {/* Bento 1: Large Analytical */}
          <div className="md:col-span-2 group relative rounded-3xl overflow-hidden bg-black/40 border border-white/5 hover:border-white/10 transition-colors animate-fade-in-up delay-200">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent z-10" />

            {/* Fake Mockup element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full flex items-end gap-2 justify-center opacity-30 group-hover:opacity-60 transition-opacity duration-1000 blur-[2px] group-hover:blur-0">
              {[20, 40, 30, 80, 60, 100].map((h, i) => <div key={i} className="w-16 rounded-t shadow-[0_0_30px_rgba(96,165,250,0.5)] bg-blue-500" style={{ height: `${h}%` }} />)}
            </div>

            <div className="relative z-20 p-8 h-full flex flex-col justify-end">
              <h3 className="text-2xl font-bold mb-2">Analytique Poussée</h3>
              <p className="opacity-70 max-w-md">Graphiques dynamiques, tendances mensuelles et visualisation instantanée de votre équilibre Revenus/Dépenses.</p>
            </div>
          </div>

          {/* Bento 2: Quick Add */}
          <div className="group relative rounded-3xl overflow-hidden bg-black/40 border border-white/5 hover:border-white/10 transition-colors animate-fade-in-up delay-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute right-[-20%] top-[-20%] w-48 h-48 bg-purple-500/20 blur-[60px] rounded-full group-hover:bg-purple-500/30 transition-colors" />

            <div className="relative p-8 h-full flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-auto">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Ajout Éclair</h3>
              <p className="opacity-70 text-sm">Raccourci global pour enregistrer une transaction en moins de 3 secondes d'où que vous soyez.</p>
            </div>
          </div>

          {/* Bento 3: Budgets */}
          <div className="group relative rounded-3xl overflow-hidden bg-black/40 border border-white/5 hover:border-white/10 transition-colors animate-fade-in-up delay-400">
            <div className="absolute inset-0 bg-gradient-to-tr from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Fake Progress */}
            <div className="absolute -bottom-4 right-4 w-3/4 bg-white/5 rounded-full h-3 border border-white/10 overflow-hidden shadow-2xl">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-300 w-[65%]" />
            </div>

            <div className="relative p-8 h-full flex flex-col">
              <h3 className="text-xl font-bold mb-2">Budgets Stricts</h3>
              <p className="opacity-70 text-sm">Allouez des limites par catégorie et suivez en temps réel la barre visuelle de consommation. Fini les mauvaises surprises.</p>
            </div>
          </div>

          {/* Bento 4: Secure Base */}
          <div className="md:col-span-2 group relative rounded-3xl overflow-hidden bg-black/40 border border-white/5 hover:border-white/10 transition-colors animate-fade-in-up delay-500">
            <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity duration-700">
              <svg className="w-64 h-64 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" /></svg>
            </div>

            <div className="relative z-20 p-8 h-full flex flex-col justify-center">
              <h3 className="text-2xl font-bold mb-2">Sécurité Bancaire (JWT)</h3>
              <p className="opacity-70 max-w-md">L'architecture repose sur FastAPI avec authentification robuste par token JWT et bases de données isolées.</p>
            </div>
          </div>

        </div>
      </section>

      {/* 3. FINANCE MARQUEE STREAM */}
      <section className="mt-10 overflow-hidden py-10 border-y border-white/5 bg-white/[0.01]">
        <div className="mb-marquee">
          <div className="mb-marquee-track">
            {[...FINANCE_STREAM, ...FINANCE_STREAM, ...FINANCE_STREAM].map((x, idx) => (
              <div key={idx} className="inline-flex items-center gap-4 mx-8">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="font-semibold">{x.title} :</span>
                <span className="opacity-60">{x.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}