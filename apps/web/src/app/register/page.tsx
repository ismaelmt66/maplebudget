"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerUser, loginUser } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) return setErr("Les mots de passe ne correspondent pas.");
    if (password.length < 6) return setErr("Mot de passe trop court (min 6).");

    try {
      setErr(null);
      setLoading(true);
      await registerUser({ email, password });
      const res = await loginUser({ email, password });
      setToken(res.access_token);
      r.push("/dashboard");
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl animate-fade-in-up delay-100">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row-reverse">

          {/* Right brand panel */}
          <div className="w-full md:w-5/12 p-10 relative overflow-hidden flex flex-col justify-center min-h-[400px]">
            {/* Background Glows */}
            <div className="absolute top-[-20%] right-[-20%] w-[150%] h-[150%] bg-gradient-to-bl from-purple-500/20 via-indigo-500/10 to-transparent blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[80%] bg-indigo-400/20 blur-[60px] pointer-events-none rounded-full" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-indigo-200 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                Démarrage Rapide
              </div>

              <h2 className="text-4xl font-bold mt-8 leading-tight tracking-tight">
                L&apos;excellence <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Financière</span>.
              </h2>

              <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-sm">
                Une architecture de classe mondiale pour propulser votre gestion budgétaire au niveau supérieur.
              </p>

              <div className="mt-10 grid gap-3 text-sm opacity-80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <span>Serveur Rapide Edge-Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="w-full md:w-7/12 p-10 md:p-14 bg-white/[0.02] relative z-10 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold">Créer un compte</h2>
              <span className="text-xs border border-white/10 bg-white/5 rounded-full px-3 py-1">
                Portail Web
              </span>
            </div>

            {err && (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <b>Erreur :</b> {err}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <label className="block text-sm font-medium text-white/80">
                Adresse Email
                <div className="mt-2">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-white/80">
                Mot de passe
                <div className="mt-2">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-white/80">
                Confirmer le mot de passe
                <div className="mt-2">
                  <Input
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </label>

              <button
                disabled={loading}
                className="mb-btn mb-btn-primary w-full mt-4 flex justify-center py-3.5"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Création en cours...
                  </>
                ) : (
                  "Créer le compte"
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-white/50">
              Déjà un compte ?{" "}
              <Link className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors" href="/login">
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}