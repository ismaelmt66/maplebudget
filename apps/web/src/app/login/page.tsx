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
    <div className="max-w-5xl mx-auto">
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* Left brand panel */}
          <div className="p-8 md:p-10 text-white bg-[linear-gradient(135deg,rgb(var(--navy)),rgb(var(--navy-2)))]">
            <div className="inline-flex items-center gap-2 text-xs bg-white/10 border border-white/15 rounded-full px-3 py-1">
              Secure Access • MFA-ready
            </div>
            <h1 className="text-3xl font-semibold mt-5 leading-tight">
              Connexion sécurisée
            </h1>
            <p className="text-sm text-white/75 mt-3">
              Accède à tes données privées (multi-utilisateurs) : transactions, analytics, objectifs.
            </p>
            <div className="mt-7 grid gap-3 text-sm">
              <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="font-medium">JWT Auth</div>
                <div className="text-white/75 mt-1">
                  Token envoyé automatiquement à l’API.
                </div>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="font-medium">Séparation des données</div>
                <div className="text-white/75 mt-1">
                  Chaque utilisateur a ses catégories, transactions, objectifs.
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <CardBody className="p-8 md:p-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-semibold">Login</div>
                <div className="text-sm text-[rgb(var(--muted))] mt-1">
                  Entre tes identifiants pour continuer.
                </div>
              </div>
              <span className="text-xs border rounded-full px-3 py-1">
                Bank UI
              </span>
            </div>

            {err && (
              <div className="mt-4 rounded-2xl border bg-black/[0.02] p-3 text-sm">
                <b>Erreur:</b> {err}
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block text-sm">
                Email
                <div className="mt-2">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
              </label>

              <label className="block text-sm">
                Mot de passe
                <div className="mt-2">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
              </label>

              <Button size="lg" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>

            <div className="mt-6 text-sm text-[rgb(var(--muted))]">
              Pas de compte ?{" "}
              <Link className="underline underline-offset-4" href="/register">
                Créer un compte
              </Link>
            </div>
          </CardBody>
        </div>
      </Card>
    </div>
  );
}