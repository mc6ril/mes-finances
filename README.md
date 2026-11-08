# Mes finances

Application web de finances personnelles, **100 % locale** : aucune donnée envoyée à un serveur, aucune connexion bancaire, aucune API externe. Les données sont stockées dans le navigateur (IndexedDB) et se sauvegardent en JSON.

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

Puis ouvrir http://127.0.0.1:5173 dans le navigateur. Après `npm install`, aucune connexion Internet n'est nécessaire.

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
    seed.ts demo.ts     Configuration initiale et données de démonstration
    ports.ts            Port de persistance + PortResult / PortFailure
  adapters/             Secondary adapters
    storage/            IndexedDB (base réelle « mes-finances », base démo séparée)
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

## Données de démonstration

« Paramètres → Explorer la démo » bascule sur une base IndexedDB distincte, remplie de données fictives. Tes données réelles ne sont jamais modifiées. Un bandeau jaune signale le mode démo.

## Évolutions et compatibilité

Le schéma est versionné (`SCHEMA_VERSION` dans `core/model.ts`, version de base IndexedDB dans l'adapter). Toute évolution passe par une migration dans `core/migrate.ts` (appliquée à l'ouverture de la base et à la restauration d'une sauvegarde) et dans l'`upgrade` IndexedDB, pour ne jamais casser les données déjà enregistrées.
