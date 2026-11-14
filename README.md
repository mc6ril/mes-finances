# Mes finances

Application web de finances personnelles, sans connexion bancaire. L'accès est protégé par un compte (Firebase Authentication : e-mail + mot de passe ou Google). Les données sont enregistrées dans Firestore, synchronisées en temps réel entre appareils, utilisables hors ligne (cache local persistant), et se sauvegardent en JSON. Un espace commun peut être partagé avec une seule personne, par lien d'invitation.

## Installation

Prérequis : Node.js 24.12 ou plus récent (`node -v` ; avec nvm : `nvm use`, d'après `.nvmrc`). Firebase et ses outils de test l'exigent.

```bash
cd ~/Projects/perso/finances
npm install
```

## Lancer l'application

```bash
npm run dev
```

Puis ouvrir http://127.0.0.1:5173 dans le navigateur. La connexion nécessite Internet et la configuration Firebase ci-dessous ; ensuite, la saisie continue hors ligne.

Version optimisée (plus rapide au quotidien) :

```bash
npm run build
npm run preview        # http://127.0.0.1:4173
```

> Le plan gratuit (Spark) n'a pas de sauvegarde automatique de la base : exporte régulièrement une sauvegarde complète depuis « Paramètres → Sauvegardes ».

## Commandes

| Commande            | Rôle                                       |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Serveur de développement                   |
| `npm test`          | Tests (Vitest), sans émulateur             |
| `npm run test:emulator` | Règles Firestore et adapter sur l'émulateur (Java 21 requis) |
| `npm run typecheck` | Vérification TypeScript                    |
| `npm run build`     | Build de production dans `dist/`           |
| `npm run format -- <fichiers>` | Prettier sur les fichiers modifiés |

## Connexion (Firebase Authentication)

1. Créer un projet sur https://console.firebase.google.com, puis une application **Web** (Paramètres du projet → Vos applications).
2. Authentication → Sign-in method : activer **E-mail/Mot de passe** et **Google**.
3. Authentication → Settings → Domaines autorisés : ajouter `127.0.0.1` (le serveur local écoute sur cette adresse ; seul `localhost` est présent par défaut) et le domaine Netlify.
4. Copier `.env.example` en `.env.local` et y reporter la configuration web (apiKey, authDomain, projectId, appId). Sur Netlify, déclarer les mêmes variables dans Site configuration → Environment variables.

Sans ces variables, l'application affiche « Connexion indisponible ».

## Base de données (Firestore)

1. Console Firebase → Firestore Database → Créer une base : édition **Standard**, emplacement européen (`europe-west9` Paris ou `eur3` ; **définitif**), démarrer en **mode production** (tout refusé, jamais le mode test).
2. Déployer les règles et index versionnés : `npx firebase login`, puis `npx firebase deploy --only firestore --project <id-du-projet>`. À refaire à chaque modification de `firestore.rules`.
3. Reprendre les données d'avant : se connecter, puis Paramètres → Sauvegardes → Restaurer, avec le fichier de sauvegarde complète. Chaque espace du fichier est recréé à son nom (le commun reçu par fichier compris).

Modèle (voir `firestore.rules`, testées dans `tests/emulator/firestoreRules.test.ts`) :

- `workspaces/{id}` : `ownerId`, `memberIds` (un seul membre pour un perso, propriétaire + un invité pour un commun), `kind`, `name`, `settings`, `schemaVersion`, `layout`. L'espace principal d'un utilisateur est `perso-{uid}`.
- `workspaces/{id}/data/{collection}__{n}` : `{ items: { [clé]: élément } }`. Chaque collection est répartie en paquets (hash de la clé) : une ouverture coûte quelques dizaines de lectures au lieu d'une par opération, pour rester dans le quota gratuit (50 000 lectures/jour) sur la durée. Une collection est redécoupée automatiquement au-delà de 640 Ko par paquet (limite Firestore : 1 Mio).
- `invitations/{token}` : lien à usage unique, valable 7 jours, lisible avec le lien, jamais listable.

Tests sur l'émulateur : `npm run test:emulator` (Java 21 : `brew install openjdk@21`, puis `JAVA_HOME=/opt/homebrew/opt/openjdk@21`). Si `private/mes-finances-sauvegarde-complete-*.json` existe (ou `FINANCES_BACKUP=chemin`), la restauration de cette vraie sauvegarde est vérifiée sans perte, localement, en ne comparant que des empreintes.

Comportement :
- Un compte créé par e-mail doit **confirmer son adresse** (lien reçu à l'inscription) avant d'accéder à l'application ; un compte Google est confirmé d'office.
- **Déconnexion** : attend l'envoi des modifications faites hors ligne, puis efface tout ce que l'application a laissé sur l'appareil (cache Firestore, anciennes bases IndexedDB, préférences).
- **Suppression du compte** (Paramètres → Mon compte, mot de passe ou fenêtre Google redemandés) : supprime d'abord les données en ligne (espaces perso, communs sans invité, invitations), transfère à l'invité un espace commun partagé, retire l'utilisateur des communs où il est invité ; puis le compte. Sans réseau, rien n'est supprimé.

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
    <domaine>/interface.ts  Ports propres à un domaine (store, espaces, sauvegarde, auth, partage, sync)
    ports.ts            Ports transverses (lecture / enregistrement de fichiers, CSV, ids, horloge)
    auth/               model (utilisateur), validation (formulaires), interface (port du fournisseur)
    store/AuthSession   Session observable (vérification, adresse à confirmer, connecté, déconnecté)
    store/FinanceStore  Espace affiché, écoute des changements venus d'ailleurs
    partage/            Invitation (validité, statut), ports du partage
    sync/               État d'envoi (hors ligne, en attente), ports des données de l'utilisateur
    usecases/auth       Inscription, connexion, Google, déconnexion, mot de passe oublié,
                        confirmation d'adresse, suppression du compte (données comprises)
    usecases/sharing    Inviter, rejoindre, retirer l'accès, quitter
    usecases/dataSession  Données ouvertes à la connexion, effacées à la déconnexion
  adapters/             Secondary adapters
    auth/               Firebase Authentication (erreurs traduites en codes auth-*)
    firebase/           Configuration et application Firebase partagée
    firestore/          Implémentation Firestore des ports du core, rangée par domaine :
      store/            Dépôt d'un espace (port core/store), découpage en paquets
      espaces/          Liste des espaces (port core/espaces), identifiants en ligne
      partage/          Invitations (port core/partage)
      auth/             Effacement des données du compte (port core/auth)
      sync/             Suivi d'envoi et état du réseau (port core/sync)
      (racine)          Connexion par utilisateur, cache navigateur, traduction des erreurs (codes sync-*)
    storage/            Effacement des données locales, lien d'invitation en attente
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
- Catégories à **budget annuel** (par défaut Voyages et Cadeaux ; réglable dans Paramètres → Catégories) : suivies sur l'année, hors du rythme mensuel du budget plaisir. Leur budget annuel ÷ 12 est compté comme provision dans les dépenses prévues.
- **Épargne** : chaque compte d'épargne (livret, assurance-vie, placement…) a sa catégorie du même nom, créée, renommée et archivée avec lui. Un espace neuf n'en a donc aucune : le budget n'affiche que les comptes réellement suivis.
- Un espace neuf démarre avec un compte courant et quelques catégories courantes, à compléter. Le tableau de bord n'affiche que ce qui a été saisi (revenus, charges, épargne…) ; tant qu'aucune opération n'existe, il présente les premiers pas.

## Espaces de suivi

Chaque espace (Perso, Commun…) est indépendant : comptes, catégories, archivages, budgets, récurrences, objectifs et réglages propres. Le sélecteur en haut du menu change d’espace.

- **Créer** un espace : Paramètres → Espaces de suivi.
- **Espaces perso** : visibles et modifiables uniquement par leur propriétaire.
- **Partager un espace commun** : bouton « Inviter », puis envoyer le lien (usage unique, 7 jours) à la personne de son choix. Elle se connecte ou crée son compte, puis rejoint l'espace ; personne d'autre n'y a accès. Le propriétaire peut retirer l'accès, l'invité peut quitter l'espace.
- **Temps réel et hors ligne** : une modification apparaît chez l'autre sans recharger ; sans réseau, la saisie continue et part au retour de la connexion (bandeau « Hors ligne »).
- **Sauvegarder** : « Tout sauvegarder » exporte tous les espaces dans un seul fichier ; « Restaurer » ce fichier recrée tous les espaces (ceux rejoints comme invité ne sont pas touchés). Les anciens fichiers, y compris ceux d'un espace reçu par fichier, restent lisibles.

## Évolutions et compatibilité

Le schéma est versionné (`SCHEMA_VERSION` dans `core/shared/model.ts`). Toute évolution passe par une migration dans `core/sauvegarde/migrate.ts`, appliquée à l'ouverture d'un espace et à la restauration d'une sauvegarde, pour ne jamais casser les données déjà enregistrées. Un appareil resté sur une ancienne version de l'application refuse d'ouvrir un espace écrit par une version plus récente (« recharge la page ») au lieu de l'écraser.

Les opérations générées par les récurrences ont un identifiant déterministe (`rec-{récurrence}-{mois}`) : deux appareils ouverts en même temps ne les doublent pas.

## Sécurité et déploiement

- `firestore.rules` : tout est refusé sauf ce qui est explicitement permis, adresse confirmée obligatoire. Testées sur l'émulateur (propriétaire, invité, autre compte, invitation expirée ou déjà utilisée, adresse non confirmée) en CI.
- `netlify.toml` : build (`npm run build` → `dist/`) et en-têtes de sécurité. La CSP limite chargements et envois au site lui-même, plus les seuls domaines Google nécessaires à la connexion (API Firebase Auth, fenêtre « Continuer avec Google ») et aux données (`firestore.googleapis.com`).
- `overrides` dans `package.json` : force une version corrigée de `@grpc/grpc-js` (dépendance Node de Firestore, absente du bundle navigateur) pour que `npm audit` reste propre.
- `.github/dependabot.yml` : mises à jour hebdomadaires des dépendances npm (et mensuelles des GitHub Actions), proposées en pull requests.
- `.github/workflows/ci.yml` : typecheck, tests, build et `npm audit` à chaque push sur `main` et sur chaque pull request ; tests des règles et de l'adapter sur l'émulateur Firestore.
