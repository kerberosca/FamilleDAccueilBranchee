# Sauvegardes de production FAB

## Responsabilités

Le service root **GestionVPS** est l'unique mécanisme de sauvegarde de
production. Il réalise un dump PostgreSQL cohérent, inclut les documents privés
FAB et les configurations nécessaires, construit une archive autonome chiffrée
avec `age`, puis la transfère vers un stockage objet avec verrouillage de
rétention.

Le service n'émet un marqueur de succès qu'après les contrôles locaux et la
vérification distante. Ce marqueur est signé et validé strictement par
`/usr/local/sbin/gestion-vps-backup-guard`. Le dépôt FAB ne contient aucune
identité `age`, destination, configuration de fournisseur ou information
d'authentification.

L'ancien cron qui écrivait des dumps et archives non chiffrés dans
`/root/fab/backups` doit être retiré lors de l'installation du service
GestionVPS. `scripts/backup-db.sh` reste un point d'entrée de compatibilité : il
démarre le service central et refuse le succès si son attestation FAB n'est pas
valide.

## Sauvegarde immédiate

Depuis le checkout de production :

```bash
bash scripts/backup-db.sh
```

Cette commande ne fabrique aucune archive dans le dépôt. Les fichiers
intermédiaires, la rétention, le chiffrement et l'envoi hors site sont gérés
exclusivement par le service root.

## Garde de déploiement

Une synchronisation Git en avance rapide peut être faite sans attestation, car
elle ne modifie pas les données. Avant un build, une recréation de conteneur ou
une migration, exécuter :

```bash
bash scripts/require-recent-backup.sh
```

Le garde exige une preuve signée, vérifiée hors site et âgée d'au plus 26
heures. `scripts/deploy-vps.sh` impose cet ordre automatiquement après le
`git pull --ff-only` et avant Docker ou Prisma. Un échec doit arrêter le
déploiement; ne pas contourner le garde et ne pas rétablir le cron historique.

## Restauration et contrôle

La restauration s'effectue dans un environnement isolé à partir d'une archive
`age`, sans écrire dans PostgreSQL ni dans le répertoire d'uploads de
production. Vérifier le manifeste, restaurer le dump, contrôler les documents
et tester l'application avant toute procédure de remplacement. Un exercice de
restauration documenté doit être réalisé au moins chaque trimestre.
