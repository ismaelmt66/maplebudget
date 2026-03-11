<div align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NextJS-Dark.svg" width="60" alt="Next.js" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/FastAPI.svg" width="60" alt="FastAPI" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TypeScript.svg" width="60" alt="TypeScript" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Python-Dark.svg" width="60" alt="Python" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TailwindCSS-Dark.svg" width="60" alt="TailwindCSS" />
  <br/>
  <h1>🍁 NexLeger</h1>
  <p><strong>Votre Gestionnaire Financier Intelligent & Moteur d'Analyse Heuristique</strong></p>
</div>

<br/>

NexLeger est une application full-stack ultra-performante conçue pour redéfinir la gestion de vos finances personnelles. Loin des tableurs austères, NexLeger propose une expérience utilisateur premium (Design *Glassmorphism* & animations fluides) couplée à un véritable moteur d'intelligence analytique.

---

## ✨ Fonctionnalités Principales

### 🤖 Intelligence Financière "God Mode"
- **Analyse Heuristique Locale :** Un moteur Python natif croise vos transactions, objectifs et patrimoine pour générer des conseils financiers personnalisés.
- **Détection d'Abonnements :** Le système de regex avancé identifie automatiquement vos paiements récurrents cachés pour vous aider à stopper l'hémorragie financière mensuelle.
- **Coach IA Interactif :** Une interface conversationnelle premium simule une IA (effet machine à écrire, rendu Markdown riche) pour interroger le moteur d'analyse en langage naturel.

### 💰 Écosystème Financier Complet
- **Suivi des Transactions & Budgets :** Ajoutez et catégorisez vos dépenses/revenus en temps réel.
- **Tableau de Bord Premium :** Graphiques interactifs (Recharts) avec animations dynamiques au survol dévoilant les tendances de vos finances.
- **Suivi de Patrimoine Net (Net Worth) :** Gardez un oeil sur l'évolution globale de tous vos actifs immobiliers et financiers.
- **Objectifs d'Épargne :** Fixez-vous des buts (Voyage, Voiture) et visualisez votre progression vers la liberté financière.

### 🏆 Gamification
- **Badges Rétro-actifs :** Un algorithme évalue la santé de vos finances à chaque connexion et débloque des trophées dynamiques (ex: *Master Saver* pour avoir épargné plus de 20% ce mois-ci).

---

## 🛠️ Stack Technique & Architecture

NexLeger repose sur une architecture moderne séparant clairement l'interface utilisateur propulsée par React de la logique mathématique gérée par Python.

### Frontend (`apps/web`)
- **Framework :** [Next.js 14](https://nextjs.org/) (App Router, Turbopack)
- **Langage :** TypeScript strict
- **Design System :** TailwindCSS v3 (Utilisation poussée du Backdrop Blur pour le Glassmorphism)
- **Visualisation :** Recharts (Graphiques SVGs animés)
- **Icônes :** Lucide React & SVGs Custom inline
- **Build Tool :** Turborepo (Gestion du Monorepo)

### Backend (`apps/api`)
- **Framework :** [FastAPI](https://fastapi.tiangolo.com/) (Haute performance, documentation auto-générée Swagger UI)
- **Langage :** Python 3.10+
- **ORM :** SQLAlchemy (Gestion des données relationnelles)
- **Sécurité :** Authentification JWT hybride avancée (JSON Web Tokens)
- **Base de Données :** SQLite (en local par défaut, migrée vers PostgreSQL en production)

---

## 🚀 Installation & Lancement Rapide

### Pré-requis
- **Node.js** (v18+)
- **Python** (v3.10+)
- **npm** (v9+)

### 1. Cloner le projet
```bash
git clone https://github.com/ismaelmt66/maplebudget.git
cd maplebudget
```

### 2. Variables d'Environnement
Copiez le fichier d'exemple et configurez vos variables :
```bash
cp .env.example apps/api/.env
```

Éditez `apps/api/.env` avec vos valeurs (clé secrète JWT, clés API IA, etc.).

### 3. Configuration Backend
Mettez en place l'environnement virtuel Python :
```bash
cd apps/api
python -m venv .venv

# Sur Windows :
.\.venv\Scripts\activate
# Sur Mac/Linux :
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. Lancement Global
Revenez à la racine du projet, installez les dépendances Node.js et lancez les serveurs :

```bash
cd ../../
npm install
npm run dev
```

- Le frontend sera disponible sur `http://localhost:3000`
- L'API backend sur `http://127.0.0.1:8000`
- La documentation Swagger UI sur `http://127.0.0.1:8000/docs`

### 5. Qualité du Code

```bash
# Lint Frontend
cd apps/web && npm run lint

# Type check TypeScript
cd apps/web && npx tsc --noEmit

# Build de production
cd apps/web && npm run build
```

---

## 🤝 Contribuer au Projet

Les pulls requests (PR) sont les bienvenues. Pour les changements majeurs, merci d'ouvrir une *issue* au préalable pour discuter de ce que vous aimeriez modifier.
1. Formatter le Frontend avec Prettier/ESLint.
2. Assurez-vous que l'API Python respecte PEP 8.
3. Vérifiez que l'interface respecte les principes directeurs de l'UI (Minimalisme, Animations fluides, "Wow Effect").

---

<div align="center">
  <p>Construit avec passion pour maîtriser ses finances personnelles de façon élégante. 🍁</p>
</div>
