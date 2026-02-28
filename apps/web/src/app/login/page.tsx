"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginUser } from "@/lib/api";
import { setToken } from "@/lib/auth";

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
    <main className="max-w-md mx-auto border rounded-3xl p-7">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="text-sm opacity-70 mt-2">
        Connecte-toi pour accéder à tes données (multi-utilisateurs).
      </p>

      {err && (
        <div className="mt-4 border rounded-2xl p-3 text-sm">
          <b>Erreur:</b> {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-3 text-sm">
        <label className="block">
          Email
          <input
            className="mt-1 w-full border rounded-xl px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block">
          Mot de passe
          <input
            type="password"
            className="mt-1 w-full border rounded-xl px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button
          disabled={loading}
          className="w-full border rounded-xl px-4 py-2 hover:bg-black/5 transition disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <div className="mt-5 text-sm opacity-70">
        Pas de compte ?{" "}
        <Link className="underline underline-offset-4" href="/register">
          Créer un compte
        </Link>
      </div>
    </main>
  );
}