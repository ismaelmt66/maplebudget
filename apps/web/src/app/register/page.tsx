"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerUser, loginUser } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";

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
          {/* Form */}
          <CardBody className="p-8 md:p-10">
            <div className="text-xl font-semibold">Créer un compte</div>
            <div className="text-sm text-[rgb(var(--muted))] mt-1">
              Ton espace sécurisé pour tes finances (éducatif).
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
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </div>
              </label>

              <label className="block text-sm">
                Confirmer le mot de passe
                <div className="mt-2">
                  <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
                </div>
              </label>

              <Button size="lg" className="w-full" disabled={loading}>
                {loading ? "Création…" : "Créer le compte"}
              </Button>
            </form>

            <div className="mt-6 text-sm text-[rgb(var(--muted))]">
              Déjà un compte ?{" "}
              <Link className="underline underline-offset-4" href="/login">
                Se connecter
              </Link>
            </div>
          </CardBody>

          {/* Right brand panel */}
          <div className="p-8 md:p-10 text-white bg-[linear-gradient(135deg,rgb(var(--navy)),rgb(var(--navy-2)))]">
            <div className="inline-flex items-center gap-2 text-xs bg-white/10 border border-white/15 rounded-full px-3 py-1">
              Private • Encrypted-ready • Institutional
            </div>
            <h2 className="text-3xl font-semibold mt-5 leading-tight">
              Une expérience “banque”
            </h2>
            <p className="text-sm text-white/75 mt-3">
              UI premium, analytics, objectifs. Tu construis une app qui ressemble à une vraie institution.
            </p>

            <div className="mt-7 grid gap-3 text-sm">
              <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="font-medium">Design system</div>
                <div className="text-white/75 mt-1">
                  Couleurs, cards, inputs, boutons cohérents.
                </div>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="font-medium">Ready for deployment</div>
                <div className="text-white/75 mt-1">
                  Le style est déjà “production grade”.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}