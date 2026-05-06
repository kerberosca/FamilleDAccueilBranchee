# Guide propriétaire - fonctionnement du site FAB

Ce document explique le fonctionnement du site **Famille d'accueil branchée (FAB)** pour la personne qui en est propriétaire ou responsable. Il sert à comprendre ce que fait le site, comment l'administrer, et quelles opérations doivent être confiées à une personne technique.

## 1. Vue d'ensemble

FAB est une plateforme de mise en relation entre :

- des **familles d'accueil** qui cherchent du soutien;
- des **alliés** qui offrent un service comme gardien compétent, entretien ménager ou tutorat;
- un **administrateur** qui vérifie les comptes, modère les profils, publie les alliés et surveille l'activité.

Le site est composé de trois grandes parties :

- **Frontend** : l'interface visible par les visiteurs, familles, alliés et admins. Elle tourne sur Next.js.
- **API backend** : le serveur qui gère les comptes, profils, recherche, messagerie, modération, paiements et permissions. Il tourne sur NestJS.
- **Base de données** : PostgreSQL, gérée avec Prisma, où sont conservés les utilisateurs, profils, abonnements, messages, journaux d'audit et état de maintenance.

En production, le tout est lancé avec Docker sur le VPS.

## 2. Les rôles

Le site connaît trois rôles principaux.

### ADMIN

L'administrateur peut accéder à la console admin, modérer les familles et les alliés, changer certains rôles, activer le mode maintenance, consulter les journaux d'audit et supprimer un profil allié si nécessaire.

### FAMILY

Une famille peut créer un compte, remplir son profil, chercher des alliés par code postal et besoin, puis contacter les alliés selon les règles d'accès de la plateforme.

La recherche publique peut montrer une version limitée des résultats. L'accès complet aux coordonnées et à la messagerie dépend de l'état d'abonnement.

### RESOURCE

Un allié peut créer son compte, remplir son formulaire, choisir son type d'aide, fournir ses informations et attendre la validation administrative. Un profil allié n'est visible publiquement que lorsqu'il est vérifié et publié.

## 3. Parcours visiteurs et utilisateurs

### Page d'accueil

La page d'accueil présente FAB, les types d'alliés et les appels à l'action principaux :

- commencer comme allié;
- comprendre le rôle d'un allié;
- rechercher des alliés par code postal.

### Inscription famille

Une famille crée un compte, complète son profil, indique sa localisation et ses besoins. Elle peut ensuite faire des recherches. Selon son abonnement, elle peut voir plus ou moins d'information et utiliser la messagerie.

### Inscription allié

Un allié suit un parcours de candidature. Le formulaire recueille notamment :

- le type d'aide offert;
- les coordonnées;
- la localisation;
- les disponibilités;
- les réponses de candidature;
- l'acceptation des déclarations obligatoires.

Après soumission, le profil passe par la modération. Il peut être en brouillon, en attente de vérification, vérifié, rejeté, caché, publié ou suspendu.

### Recherche

La recherche fonctionne par code postal complet ou par préfixe de trois caractères. C'est une version simple du rapprochement géographique. Pour une recherche plus précise par distance réelle, il faudra plus tard ajouter une logique géospatiale.

### Messagerie

La messagerie sert à créer une conversation entre une famille et un allié. La logique actuelle limite la conversation au lien famille-allié et évite les conversations libres entre tous les utilisateurs.

## 4. Console admin

La console admin se trouve à l'adresse :

```text
/admin
```

Elle est réservée aux comptes ayant le rôle `ADMIN`.

### Mode maintenance

Dans la console admin, il est possible d'activer ou de désactiver le mode maintenance.

Quand la maintenance est activée :

- les visiteurs voient une page de maintenance;
- les routes essentielles comme le healthcheck restent disponibles;
- l'admin peut garder le contrôle depuis la console.

Utiliser ce mode avant une opération délicate, par exemple une intervention sur les données ou une mise à jour importante.

### Onglet Familles

L'onglet familles permet de :

- chercher une famille par email, nom, ville ou code postal;
- filtrer selon le statut;
- voir l'état d'abonnement;
- activer ou bannir une famille;
- traiter plusieurs familles à la fois;
- changer le rôle d'un compte si nécessaire.

Un statut `BANNED` bloque l'utilisateur concerné.

### Onglet Alliés

L'onglet alliés permet de :

- chercher un allié par nom, email, ville ou code postal;
- filtrer par statut de vérification ou publication;
- consulter les informations de candidature;
- approuver et publier un allié;
- rejeter ou suspendre un allié;
- suivre l'état de vérification des antécédents;
- supprimer définitivement un profil allié.

Attention : la suppression efface le compte et le profil de la base de données. Cette action doit être réservée aux cas où la suppression est vraiment voulue.

### Onglet Audit

L'onglet audit liste les actions administratives importantes :

- modération;
- changement de statut;
- changement de rôle;
- autres actions tracées par le backend.

Ce journal aide à savoir qui a fait quoi, et quand.

## 5. Paiements et abonnements

Le site utilise Stripe pour :

- les paiements liés à l'inscription ou au parcours allié;
- les abonnements famille;
- les webhooks qui mettent à jour l'état des abonnements.

Le backend contient un endpoint de webhook Stripe :

```text
POST /api/v1/billing/stripe/webhook
```

En production, Stripe doit être configuré pour appeler cette adresse avec le bon secret de signature. Les clés Stripe doivent rester dans le fichier `.env` du serveur, jamais dans GitHub.

## 6. Données conservées

La base de données contient notamment :

- utilisateurs et rôles;
- profils familles;
- profils alliés;
- abonnements Stripe;
- conversations et messages;
- journaux d'audit admin;
- tokens de réinitialisation de mot de passe;
- état de maintenance.

Les documents plus détaillés sur les données et la confidentialité se trouvent dans :

- `docs/INVENTAIRE-DONNEES.md`
- `docs/PROCEDURE-INCIDENT-CONFIDENTIALITE.md`
- `docs/analyse-risques.md`

## 7. Ce qui est public et ce qui est protégé

Public :

- page d'accueil;
- pages d'information;
- formulaire ou début de parcours selon les pages;
- recherche limitée;
- statut de maintenance;
- healthcheck technique.

Protégé par connexion :

- espace famille;
- espace allié;
- messagerie;
- coordonnées complètes selon abonnement;
- console admin.

Protégé par rôle admin :

- modération;
- audit;
- changement de rôle;
- bannissement;
- maintenance;
- suppression de profils.

## 8. Lancement local pour tester

Sur un ordinateur de développement avec Docker Desktop, à la racine du projet :

```powershell
docker compose up -d
```

Adresses locales :

```text
Frontend : http://localhost:3002
API      : http://localhost:3000
Swagger  : http://localhost:3000/docs
Health   : http://localhost:3000/api/v1/health
```

Pour arrêter :

```powershell
docker compose down
```

Le mode local active des facilités de développement. Il ne doit pas être confondu avec la production.

## 9. Déploiement sur le VPS

Le déploiement complet est documenté dans :

```text
docs/DEPLOI-ETAPES.md
```

Résumé du principe :

1. tester localement;
2. vérifier que le build production fonctionne;
3. envoyer le code sur GitHub;
4. se connecter au VPS;
5. récupérer la dernière version;
6. reconstruire et relancer Docker.

Commandes typiques sur le VPS :

```bash
cd ~/fab
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

La commande de migration est nécessaire lorsqu'une mise à jour modifie la structure de la base de données.

## 10. Sauvegardes

Un script de sauvegarde existe :

```text
scripts/backup-db.sh
```

Il crée une sauvegarde PostgreSQL compressée dans un dossier `backups/` et garde seulement les sauvegardes récentes.

Sur le VPS, depuis le dossier du projet :

```bash
./scripts/backup-db.sh
```

Recommandation propriétaire :

- faire une sauvegarde avant une mise à jour importante;
- vérifier régulièrement qu'une sauvegarde récente existe;
- conserver parfois une copie hors du VPS, surtout avant des opérations sensibles.

## 11. Variables importantes

Les variables sensibles sont dans `.env`. Ce fichier ne doit pas être publié sur GitHub.

Le fichier `.env.example` sert de modèle. Les variables importantes incluent :

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_API_URL`
- `APP_FRONTEND_URL`
- `CORS_ORIGINS`
- clés et secrets Stripe
- configuration email Resend, si utilisée

Règle simple : si une valeur ressemble à un mot de passe, un secret, une clé API ou un token, elle doit rester uniquement dans `.env` sur le PC de travail ou le VPS.

## 12. Bonnes pratiques d'exploitation

Avant une mise à jour :

- faire une sauvegarde;
- activer la maintenance si l'intervention peut déranger les visiteurs;
- vérifier que le build passe;
- noter ce qui change.

Après une mise à jour :

- ouvrir la page d'accueil;
- tester une connexion;
- vérifier `/api/v1/health`;
- vérifier la console admin;
- désactiver la maintenance;
- surveiller les erreurs ou comportements inhabituels.

Pour la modération :

- publier seulement les alliés vérifiés;
- suspendre plutôt que supprimer si un doute existe;
- consulter l'audit pour comprendre les changements récents;
- utiliser la suppression définitive seulement quand elle est justifiée.

Pour les données personnelles :

- limiter l'accès admin aux personnes de confiance;
- ne pas envoyer les exports ou sauvegardes par des canaux non sécurisés;
- garder une trace des incidents;
- consulter la procédure d'incident en cas de fuite ou erreur.

## 13. Quand appeler un développeur

Appeler un développeur si :

- le site ne démarre plus;
- les paiements Stripe ne mettent pas les abonnements à jour;
- une migration Prisma échoue;
- la base de données semble corrompue;
- il faut restaurer une sauvegarde;
- une page affiche une erreur persistante;
- il faut modifier les règles de recherche, d'abonnement ou de modération;
- il faut ajouter une fonctionnalité ou changer un parcours utilisateur.

## 14. Fichiers utiles

```text
README.md                         Vue technique rapide
docs/DEPLOI-ETAPES.md             Procédure de déploiement
docs/GITHUB-ET-VPS.md             Lien entre GitHub et VPS
docs/INVENTAIRE-DONNEES.md        Données conservées
docs/PROCEDURE-INCIDENT-CONFIDENTIALITE.md
scripts/backup-db.sh              Sauvegarde de la base
docker-compose.yml                Environnement local
docker-compose.prod.yml           Environnement production VPS
prisma/schema.prisma              Structure de la base
frontend/app                      Pages du site
src/modules                       Modules backend
```

## 15. Résumé en une phrase

FAB est une plateforme où les familles trouvent des alliés locaux, où les alliés doivent être vérifiés avant publication, et où l'administrateur garde le contrôle de la modération, des accès, de la maintenance et du suivi des actions importantes.
