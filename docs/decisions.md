# Décisions

Règles validées du projet, une ligne chacune : la décision, puis pourquoi.
Une décision prise en conversation va d'abord dans [decisions-a-valider.md](decisions-a-valider.md).

## Architecture

- Hexagonale : `core/` (métier) ne connaît ni React, ni le navigateur, ni Firebase. Testable en node, fournisseur remplaçable.
- Firebase seulement dans `adapters/`, derrière les ports du core (`<domaine>/interface.ts`). Même raison.
- Le core ne capture aucune erreur ; les adapters traduisent les erreurs techniques en `PortFailure` typées ; l'UI choisit le message. Chaque couche ne gère que ce qu'elle comprend.
- `ui/pages/` assemble seulement ; les blocs reliés aux données sont des organismes. Pages courtes et lisibles.

## Calculs

- Montants en centimes entiers. Pas d'erreur d'arrondi.
- Virement interne et investissement : jamais dépense ni revenu. Sinon l'argent est compté deux fois.
- Dépense remboursée : saisie positive dans la même catégorie. La catégorie montre la dépense nette.
- Opération « prévue » hors du réel, passée automatiquement à sa date. Le budget compare au réel.
- Solde actuel : opérations vérifiées seulement. Il doit correspondre au relevé.
- Patrimoine : versements, intérêts, frais et plus-values séparés ; une valorisation n'est jamais un revenu. Savoir ce qui vient de soi et ce qui vient du marché.
- Catégories à budget annuel (voyages, cadeaux) hors du budget mensuel, provisionnées au douzième. Éviter les faux dépassements.

## Données

- Schéma versionné (`SCHEMA_VERSION`), migration à chaque évolution, appliquée à l'ouverture et à la restauration. Ne jamais casser une donnée enregistrée.
- Un appareil resté sur une ancienne version refuse d'ouvrir un espace écrit par une version plus récente. Pas d'écrasement.
- Récurrences retirées (v0.11). Elles créaient des doublons avec l'import CSV. À rouvrir après le rapprochement (piste F1).
- Sauvegarde complète chiffrée par mot de passe, dans le navigateur. Le fichier sort de l'app ; mot de passe perdu = fichier perdu.

## Sécurité

- `firestore.rules` : tout refusé sauf ce qui est permis, adresse e-mail confirmée obligatoire, règles testées sur l'émulateur en CI.
- Espace commun partagé avec une seule personne, par lien à usage unique (7 jours). Limiter qui voit des données financières.
- CSP limitée au site et aux seuls domaines Google nécessaires.
- Aucune donnée personnelle réelle dans le dépôt, les tests ou les captures.

## Tests

- On teste la logique (core, état d'écran), pas le rendu : pas de tests de composants ni d'architecture. Le rendu change souvent, la logique porte les bugs coûteux.
- TDD : test rouge, code, test vert.
- E2e limité à 2 ou 3 parcours critiques. Lents et fragiles à maintenir.
- Règles Firestore et adapters testés sur l'émulateur. Seul moyen de tester les règles pour de vrai.

## Outillage

- Dépendances à version exacte. Builds reproductibles ; Dependabot propose les mises à jour.
- Biome pour le formatage, l'ordre des imports et le lint, vérifié en CI. Un seul outil, rapide.

## Process

- Branches parties de `main-dev`, PR vers `main-dev`. `main` n'avance que par le workflow Release, qui déploie.
- Compte GitHub `mc6ril` uniquement. Projet personnel.
- Code, commits, PR et docs en français.
