# Logique Produit : Budgets vs. Catégories

Ce document clarifie la relation et le flux de travail entre les Catégories et les Budgets dans NexLedger.

## Problème Initial

Auparavant, la gestion des budgets était répartie sur deux sections distinctes :

1.  **Page Catégories (`/finances/categories`)**: C'est ici que l'utilisateur pouvait définir une "limite budgétaire" pour chaque catégorie.
2.  **Page Budget (`/finances/budget`)**: Cette page affichait le suivi des dépenses par rapport aux limites définies sur la page Catégories.

Cette séparation était source de confusion pour l'utilisateur, qui devait naviguer entre deux sections pour accomplir une seule tâche cohérente : la gestion de ses budgets.

## Logique Consolidée

Pour rendre le parcours plus intuitif et puissant, la fonctionnalité a été centralisée.

### 1. La Page Budget : Le Hub Central

La page **Budget (`/finances/budget`)** est désormais le seul et unique endroit pour toute la gestion budgétaire.

-   **Rôle principal** : Suivre en temps réel la consommation des budgets pour le mois en cours. Fournir des indicateurs visuels (barres de progression, alertes de couleur) pour chaque catégorie budgétée.
-   **Gestion des limites** : Un bouton "Gérer les budgets" est désormais présent sur cette page. Il ouvre une fenêtre modale où l'utilisateur peut voir la liste de **toutes ses catégories de dépenses** et définir ou modifier la limite mensuelle pour chacune.

Le fait de sauvegarder une limite dans cette modale crée ou met à jour l'alerte budget correspondante, ce qui la fait apparaître instantanément sur la page Budget.

### 2. La Page Catégories : Un Rôle Clarifié

La page **Catégories (`/finances/categories`)** a maintenant un rôle plus simple et plus clair.

-   **Rôle unique** : Gérer la liste des catégories elles-mêmes. Cela inclut :
    -   Créer, renommer ou supprimer des catégories.
    -   Assigner leur type (`Revenu` ou `Dépense`).

La notion de "limite budgétaire" a été complètement retirée de cette page pour éviter toute ambiguïté.

## Nouveau Parcours Utilisateur

Le parcours utilisateur est maintenant linéaire et logique :

1.  L'utilisateur va dans **Catégories** pour s'assurer que ses postes de dépenses et de revenus sont bien organisés (ex: "Courses", "Loyer", "Salaire").
2.  L'utilisateur va dans **Budget** pour assigner des limites à ses postes de dépenses ("Courses": 500$, "Loyer": 1200$) et suivre leur évolution au cours du mois.

Cette consolidation élimine la redondance et crée une expérience plus fluide et professionnelle, conforme aux standards des meilleures applications fintech.
