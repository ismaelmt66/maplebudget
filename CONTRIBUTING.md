# Guide de Contribution 🍁

Merci d'envisager de contribuer à **NexLeger V2** ! Que ce soit pour remonter un bug, suggérer une fonctionnalité ou écrire du code, votre aide est inestimable pour rendre la gestion financière accessible et élégante.

## 🐛 Remonter un Bug

Avant de créer une *Issue*, merci de vérifier qu'elle n'a pas déjà été signalée. 
Si vous créez un nouveau ticket, incluez :
- Une description claire du problème.
- Les étapes pour reproduire le bug.
- L'environnement (OS, Navigateur, Version de Node/Python).
- Des captures d'écran si le bug est visuel (ex: design *Glassmorphism* cassé).

## ✨ Suggérer une Nouvelle Fonctionnalité

Nous adorons les idées qui rendent les finances personnelles plus intelligentes et plus belles !
- Décrivez le besoin utilisateur.
- Proposez une solution technique ou UI.
- Si cela implique un changement majeur de l'IA Héuristique (`FinancialAIEngine`), détaillez l'impact sur les performances.

## 💻 Contribuer au Code

### 1. Environnement Local
Consultez le `README.md` pour les instructions d'installation avec Turborepo et l'environnement Python.

### 2. Normes de Code (Frontend - Next.js)
- **TypeScript Strict** : Zéro erreurs `any` tolérées.
- **Micro-Animations** : Privilégiez l'utilisation de TailwindCSS pour les transitions légères (`transition-all duration-300`).
- **Composants** : Gardez les composants de la `HeaderBar`, du `Dashboard` et de l'`IA Coach` modulaires et réutilisables.

### 3. Normes de Code (Backend - FastAPI)
- **PEP 8** : Respectez les conventions Python.
- **Type Hints** : Indispensables pour les paramètres et les retours de fonctions.
- **Tests** : Assurez-vous que l'intégrité de la base de données (Calcul de Patrimoine, Soldes) reste intacte après vos modifications.

### 4. Processus de Pull Request (PR)
1. Forkez le projet.
2. Créez une branche explicite : `feature/nom-de-la-feature` ou `fix/nom-du-bug`.
3. Commitez vos changements avec des descriptions claires (ex: `feat: add export to CSV button`).
4. Poussez (Push) sur votre Fork.
5. Ouvrez une Pull Request en utilisant le modèle fourni.

Merci pour votre temps et vos compétences ! 🚀
