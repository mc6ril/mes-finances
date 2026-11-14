# Mes finances

Application web de finances personnelles, sans connexion bancaire. Les données sont stockées dans le navigateur (IndexedDB) et se sauvegardent en JSON. L'accès est protégé par un compte (Firebase Authentication : e-mail + mot de passe ou Google) ; la synchronisation des données via Firestore est en cours.

## Installation

Prérequis : Node.js 20 ou plus récent (`node -v`).

```bash
cd ~/Projects/perso/finances
npm install
```

## Lancer l'application

```bash
npm run dev
```

Puis ouvrir http://127.0.0.1:5173 dans le navigateur. La connexion nécessite Internet et la configuration Firebase ci-dessous.

Version optimisée (plus rapide au quotidien) :

```bash
npm run build
npm run preview        # http://127.0.0.1:4173
```

> Les données sont liées au navigateur **et** à l'adresse utilisée (`127.0.0.1:5173` et `127.0.0.1:4173` ont chacune leurs données). Choisis-en une et garde-la, et exporte régulièrement une sauvegarde depuis « Paramètres et sauvegardes ».

## Commandes

| Commande            | Rôle                                       |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Serveur de développement                   |
| `npm test`          | Tests des calculs (Vitest)                 |
| `npm run typecheck` | Vérification TypeScript                    |
| `npm run build`     | Build de production dans `dist/`           |
| `npm run format -- <fichiers>` | Prettier sur les fichiers modifiés |

## Connexion (Firebase Authentication)

1. Créer un projet sur https://console.firebase.google.com, puis une application **Web** (Paramètres du projet → Vos applications).
2. Authentication → Sign-in method : activer **E-mail/Mot de passe** et **Google**.
3. Authentication → Settings → Domaines autorisés : ajouter `127.0.0.1` (le serveur local écoute sur cette adresse ; seul `localhost` est présent par défaut) et le domaine Netlify.
4. Copier `.env.example` en `.env.local` et y reporter la configuration web (apiKey, authDomain, projectId, appId). Sur Netlify, déclarer les mêmes variables dans Site configuration → Environment variables.

Sans ces variables, l'application affiche « Connexion indisponible ».

## Architecture (hexagonale)

```
src/
  core/                 Logique métier pure, sans React ni navigateur
    model.ts            Types (montants en centimes entiers)
    money.ts dates.ts   Parsing des montants FR, mois, années bissextiles
    balances.ts         Soldes, virements internes, prévu / réalisé
    budget.ts           Lignes de budget, report, remboursements, totaux
    patrimoine.ts       Versements vs performance, valorisations, compte commun
    annual.ts           Bilan annuel et texte généré
    goals.ts            Objectifs et scénarios de rendement (hypothèses)
    csvImport.ts        Mapping CSV, doublons, export CSV
    recurring.ts        Opérations récurrentes
    backup.ts           Sauvegarde / restauration validée et versionnée
    seed.ts             Configuration initiale (vierge)
    workspaces.ts       Espaces de suivi indépendants (Perso, Commun…)
    <domaine>/interface.ts  Ports propres à un domaine (store, espaces, sauvegarde, auth)
    ports.ts            Ports transverses (lecture / enregistrement de fichiers, CSV, ids, horloge)
    auth/               model (utilisateur), validation (formulaires), interface (port du fournisseur)
    store/AuthSession   Session observable (vérification, connecté, déconnecté)
    usecases/auth       Inscription, connexion, Google, déconnexion, mot de passe oublié
  adapters/             Secondary adapters
    auth/               Firebase Authentication (erreurs traduites en codes auth-*)
    storage/            IndexedDB (une base par espace) et liste des espaces
    files/              Lecture de fichiers, CSV (PapaParse), téléchargements
  app/                  Primary adapters : store, actions, sélecteurs, thème
  ui/
    design-system/      Text, Title, Button, Card, Field, Modal…
    layout/ charts/ pages/
tests/                  Tests Vitest (core + adapters)
```

Règles : le core ne capture aucune erreur ; les adapters traduisent les erreurs techniques en `PortFailure` typées ; l'UI décide de l'affichage.

## Règles de calcul importantes

- Tous les montants sont des **centimes entiers**.
- Un **virement interne** (ou un investissement) n'est jamais compté comme dépense de consommation ni comme revenu ; il crédite le compte destinataire.
- Les opérations **prévues** ne comptent pas dans le réel tant qu'elles ne sont pas passées en « réalisé » ou « rapproché ». Elles basculent automatiquement en « réalisé » à leur date (à l'ouverture de l'app et au retour sur l'onglet).
- Une dépense **remboursée** se saisit comme dépense positive dans la même catégorie : elle réduit la catégorie.
- Patrimoine : on distingue **sommes versées**, **intérêts**, **frais**, **plus/moins-values** et **valeur totale**. Les valorisations boursières n'entrent jamais dans les revenus.
- Le compte commun immobilier est affiché à part ; il n'entre dans le patrimoine personnel qu'une fois la quote-part renseignée.
- Catégories à **budget annuel** (par défaut Voyages, Cadeaux, Dépenses exceptionnelles ; réglable dans Paramètres → Catégories) : suivies sur l'année, hors du rythme mensuel du budget plaisir et du budget plaisir mensuel. Leur budget annuel ÷ 12 est compté comme provision dans l'enveloppe.
- Mode **simplifié** : seules l'épargne personnelle et les dépenses plaisir sont suivies dans l'enveloppe de 460 € (charges déjà déduites). Mode **complet** : tout le compte courant. Les deux modes ne s'additionnent jamais.

## Espaces de suivi

Chaque espace (Perso, Commun…) est une base IndexedDB indépendante : comptes, catégories, archivages, budgets, récurrences, objectifs et réglages propres. Le sélecteur en haut du menu change d’espace.

- **Créer** un espace : Paramètres → Espaces de suivi.
- **Sauvegarder** : « Tout sauvegarder » exporte tous les espaces (importés compris) dans un seul fichier ; « Restaurer » ce fichier recrée tous les espaces.
- **Partager** un espace : Sauvegardes → Partager un espace, puis envoyer le fichier JSON. Seul l’espace choisi est dans le fichier.
- **Recevoir** un espace : Paramètres → Importer un espace. Il est créé en lecture seule ; un import suivant du même espace le remplace.

La base historique « mes-finances » est l’espace « Perso » : aucune migration n’est nécessaire.

## Évolutions et compatibilité

Le schéma est versionné (`SCHEMA_VERSION` dans `core/model.ts`, version de base IndexedDB dans l'adapter). Toute évolution passe par une migration dans `core/migrate.ts` (appliquée à l'ouverture de la base et à la restauration d'une sauvegarde) et dans l'`upgrade` IndexedDB, pour ne jamais casser les données déjà enregistrées.

## Sécurité et déploiement

- `netlify.toml` : build (`npm run build` → `dist/`) et en-têtes de sécurité. La CSP limite chargements et envois au site lui-même, plus les seuls domaines Google nécessaires à la connexion (API Firebase Auth, fenêtre « Continuer avec Google »).
- `overrides` dans `package.json` : force une version corrigée de `@grpc/grpc-js` (dépendance Node de Firestore, absente du bundle navigateur) pour que `npm audit` reste propre.
- `.github/dependabot.yml` : mises à jour hebdomadaires des dépendances npm (et mensuelles des GitHub Actions), proposées en pull requests.
- `.github/workflows/ci.yml` : typecheck, tests, build et `npm audit` à chaque push sur `main` et sur chaque pull request.
