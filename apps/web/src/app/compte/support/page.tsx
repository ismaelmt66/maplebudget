"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "Comment ajouter une transaction ?",
    a: "Utilisez le bouton \"+\" dans la barre de navigation pour un ajout rapide, ou rendez-vous dans Finances > Transactions pour ajouter manuellement avec tous les details (date, categorie, montant, description).",
  },
  {
    q: "Comment configurer un budget ?",
    a: "Allez dans Finances > Budgets. Vous pouvez definir une limite mensuelle par categorie. L'application vous alertera quand vous approchez ou depassez vos limites.",
  },
  {
    q: "Comment fonctionnent les transactions recurrentes ?",
    a: "La detection automatique identifie les paiements reguliers (loyer, abonnements). Vous pouvez aussi les ajouter manuellement dans Finances > Depenses Recurrentes avec la frequence souhaitee.",
  },
  {
    q: "Comment fonctionne l'analyse IA ?",
    a: "L'analyse IA evalue votre sante financiere selon 4 criteres : fonds d'urgence, dettes, diversification et valeur nette. Elle genere un rapport complet avec score, projections et recommandations personnalisees.",
  },
  {
    q: "Comment exporter mes donnees ?",
    a: "Rendez-vous dans Outils > Export Donnees. Vous pouvez filtrer par date et telecharger vos transactions au format CSV, compatible avec Excel et Google Sheets.",
  },
  {
    q: "Comment fonctionnent les categories ?",
    a: "Les categories organisent vos revenus et depenses. Elles sont creees lors de l'onboarding et personnalisables dans Finances > Categories. Chaque transaction est associee a une categorie.",
  },
  {
    q: "Comment activer l'authentification a deux facteurs (2FA) ?",
    a: "Allez dans Compte > Securite. Cliquez sur 'Activer 2FA', scannez le QR code avec une application comme Google Authenticator, puis entrez le code de verification.",
  },
  {
    q: "Comment definir des objectifs financiers ?",
    a: "Dans Planification > Objectifs, creez un objectif en indiquant le nom, le montant cible et la date souhaitee. L'application calculera un plan d'epargne personnalise.",
  },
];

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    setSubject("");
    setDescription("");
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <main className="mb-container py-10 space-y-10 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">Support</span>
        </h1>
        <p className="text-white/50 mt-1">Aide, FAQ et nous contacter</p>
      </div>

      {/* FAQ */}
      <section className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 md:p-8">
        <h2 className="text-lg font-bold mb-6">Questions Frequentes</h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className={`rounded-2xl border transition-all ${isOpen ? "border-white/15 bg-white/5" : "border-white/5 hover:border-white/10"}`}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-white/80 pr-4">{item.q}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 text-white/30 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-white/50 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact */}
        <section className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
          <h2 className="text-lg font-bold mb-4">Nous Contacter</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-white/80">Email</div>
                <div className="text-sm text-white/50 mt-0.5">support@nexledger.app</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-white/80">Delai de reponse</div>
                <div className="text-sm text-white/50 mt-0.5">Sous 24h en jours ouvrables</div>
              </div>
            </div>
          </div>
        </section>

        {/* Bug Report */}
        <section className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-6">
          <h2 className="text-lg font-bold mb-4">Signaler un Probleme</h2>

          {sent && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              Rapport envoye. Merci !
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Sujet</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                placeholder="Ex: Erreur lors de l'export"
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="Decrivez le probleme rencontre..."
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all placeholder:text-white/20 resize-none"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-sm font-medium hover:bg-indigo-500/25 transition-all"
            >
              Envoyer le rapport
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
