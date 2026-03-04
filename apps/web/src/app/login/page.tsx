"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginUser } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState("a@test.com");
  const [password, setPassword] = useState("test1234");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setErr(null);
      setLoading(true);
      const res = await loginUser({ email, password });
      setToken(res.access_token);
      r.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl animate-fade-in-up">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row">

          {/* Left brand panel */}
          <div className="w-full md:w-5/12 p-10 relative overflow-hidden flex flex-col justify-center min-h-[400px]">
            {/* Background Glows */}
            <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-gradient-to-br from-indigo-500/20 via-blue-500/10 to-transparent blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-blue-400/20 blur-[60px] pointer-events-none rounded-full" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-blue-200 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Accès Sécurisé
              </div>

              <h1 className="text-4xl font-bold mt-8 leading-tight tracking-tight">
                Bon retour sur <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">NexLeger</span>.
              </h1>

              <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-sm">
                Connectez-vous pour accéder à votre tableau de bord, analyser vos performances et gérer vos transactions.
              </p>

              <div className="mt-10 grid gap-3 text-sm opacity-80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <span>Chiffrement bout-en-bout (JWT)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="w-full md:w-7/12 p-10 md:p-14 bg-white/[0.02] relative z-10 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold">Connexion</h2>
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
                    className="w-full bg-black/40 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 rounded-xl"
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
                    autoComplete="current-password"
                    className="w-full bg-black/40 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 py-3 rounded-xl"
                  />
                </div>
              </label>

              <button
                disabled={loading}
                className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Connexion en cours...
                  </>
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-white/50">
              Pas de compte ?{" "}
              <Link className="text-blue-400 hover:text-blue-300 font-medium transition-colors" href="/register">
                Créer un compte
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}