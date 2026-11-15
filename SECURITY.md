# Sécurité

## Signaler une faille

Merci de **ne pas ouvrir d'issue publique** pour une faille de sécurité.

Utilisez le signalement privé de GitHub : onglet **Security** → **Report a vulnerability**
([lien direct](https://github.com/mc6ril/mes-finances/security/advisories/new)).

Indiquez si possible :

- la partie concernée (application web, règles Firestore, workflows GitHub…) ;
- les étapes pour reproduire ;
- l'impact estimé.

N'incluez aucune donnée personnelle réelle ni aucun identifiant dans le signalement.

## Versions suivies

Seule la dernière version publiée (dernière release, branche `main`) reçoit des correctifs.

## Périmètre

- Application web et son déploiement.
- Règles de sécurité Firestore (`firestore.rules`).
- Workflows GitHub Actions du dépôt.

La configuration web Firebase présente dans l'application est publique par conception : la protection
des données repose sur l'authentification et les règles Firestore.
