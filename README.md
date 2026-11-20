# Mes finances

Application web de finances personnelles : comptes, budget du mois, épargne et patrimoine, objectifs, bilan annuel. Un espace commun se partage avec une seule personne, pour suivre un compte de foyer et le règlement de fin de mois.

En ligne : https://mes-finances-271ea.web.app

## Principes

- **Sans connexion bancaire.** Les opérations viennent des relevés CSV importés ou de la saisie.
- **Compte obligatoire.** Données dans le cloud (Firestore), synchronisées entre appareils. Une coupure de réseau ne bloque pas la saisie : les modifications partent au retour de la connexion.
- **Données à soi.** Personne d'autre que soi n'y a accès, sauf la personne invitée sur un espace commun. Sauvegarde complète chiffrée par mot de passe.

## Documentation

- [Décisions](docs/decisions.md) : ce qui a été décidé, et pourquoi.
- [Exploitation](docs/exploitation.md) : installer, lancer, configurer Firebase, déployer.
- [Pistes d'amélioration](docs/pistes-amelioration.md)
- [Sécurité](SECURITY.md) : signaler une faille.
