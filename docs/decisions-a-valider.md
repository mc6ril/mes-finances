# Décisions à valider

Décisions prises en conversation. Elles s'appliquent au chantier en cours, pas encore comme règles générales.
À relire dans une conversation dédiée : garder (passe dans [decisions.md](decisions.md)), reformuler ou jeter, puis retirer d'ici.

| Date       | Décision                                                                                                                                        | Pourquoi                                                                               | Contexte    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------- |
| 2026-11-20 | Trois couches : règles métier dans `core/`, état d'écran en fonctions pures dans `hooks/<domaine>/`, texte affiché dans `ui/labels/<domaine>/`. | Le choix des mots relève de l'interface, pas des hooks ; chaque couche se teste seule. | Chantier C2 |
| 2026-11-20 | Fonctions de texte nommées d'après ce qu'elles renvoient (`…Label`, `…Message`), pas « mapper ».                                                | « Mapper » désigne une conversion de données.                                          | Chantier C2 |
| 2026-11-20 | README = le projet ; le reste dans `docs/decisions.md` et `docs/exploitation.md` ; règles IA dans `CLAUDE.md`.                                  | Le README expliquait le code et vieillissait mal.                                      | PR docs     |
| 2026-11-20 | Le journal des décisions, rangé par catégorie, remplace les docs d'architecture et de conventions.                                              | Peu de mots, moins à lire avant de coder.                                              | PR docs     |
| 2026-11-20 | Une décision prise en conversation passe par ce fichier avant `decisions.md`.                                                                   | Une décision prise à chaud dépend de son contexte.                                     | PR docs     |
| 2026-11-20 | « Hors ligne » n'est plus un principe : compte obligatoire, la saisie continue seulement pendant une coupure.                                   | La première connexion exige Internet.                                                  | PR docs     |
