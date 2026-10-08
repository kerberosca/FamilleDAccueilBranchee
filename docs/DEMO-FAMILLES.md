# Site de démonstration pour les familles

Adresse prévue : **https://demo.familledaccueilbranchee.ca/**. La démo utilise le vrai frontend et la vraie API FAB, avec une base PostgreSQL propre à la démo. Aucun compte, profil ou message de la production n'est copié.

Le code QR prêt à imprimer se trouve dans `docs/qr-demo-familles.png`. Il mène à cette adresse; ne le distribuer qu'après la mise en ligne et le contrôle sur téléphone.

## Parcours présenté

1. Chaque visiteur ouvre le lien ou le code QR et clique sur **Entrer dans la démo**.
2. L'API crée un compte famille fictif individuel, sans demander de courriel ou de mot de passe.
3. Le visiteur recherche des alliés fictifs (`H2X`, `G1R`, `J1H`), ouvre un profil et utilise sa propre messagerie.
4. L'accès de démonstration donne accès à la recherche et aux messages sans Stripe. Les comptes temporaires et leurs messages sont supprimés automatiquement après environ 24 heures (au démarrage de l'API et ensuite toutes les 15 minutes).

Le site porte une bannière permanente **Démonstration**. Il demande de ne pas saisir de renseignements personnels. Les courriels, paiements, webhooks sortants et contournements de connexion de développement sont désactivés dans la configuration Docker de la démo.

## Préparer le VPS avec GestionVPS

Le serveur actuel est administré avec le compte `linuxuser`, Plink et la clé chargée dans Pageant. Ne pas utiliser une connexion directe comme `root`. Avant d'ajouter les trois conteneurs démo, vérifier l'espace disque, la mémoire disponible et l'état des sites dans GestionVPS. Déclencher **Avant maintenance** dans la console GestionVPS et attendre la vérification hors site de la sauvegarde. Le garde `scripts/require-recent-backup.sh` doit ensuite réussir avant toute construction ou migration.

Conserver le dépôt de production `/root/fab` sur sa branche `main`. Après publication de la branche `codex/demo-familles`, créer une copie de travail distincte `/root/fab-demo` depuis cette branche. Le projet Compose `fab-demo` et son volume PostgreSQL restent ainsi séparés du site principal. Mettre à jour cette copie par avance rapide uniquement; ne pas lancer `docker compose` sans le fichier `docker-compose.demo.yml`.

La première installation peut se faire depuis une session administrateur autorisée sur le VPS :

```bash
cd /root/fab
git fetch origin codex/demo-familles
git worktree add --detach /root/fab-demo origin/codex/demo-familles
cd /root/fab-demo
bash scripts/require-recent-backup.sh
```

Pour les mises à jour suivantes, exécuter `git -C /root/fab fetch origin codex/demo-familles`, puis `git -C /root/fab-demo switch --detach origin/codex/demo-familles` après avoir vérifié que la copie démo ne contient pas de modifications suivies localement.

Créer un enregistrement DNS `A` pour `demo.familledaccueilbranchee.ca` vers l'adresse publique du VPS. Ne pas modifier les enregistrements du domaine principal.

Dans `/root/fab-demo`, copier `.env.demo.example` en `.env.demo`, créer des secrets aléatoires différents pour `DEMO_POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` et `ADMIN_PASSWORD`, puis limiter la lecture du fichier au propriétaire. Le mot de passe PostgreSQL doit être composé de caractères sûrs pour une URL (l'hexadécimal convient). **Ne jamais recopier le `.env` de production.**

Les ports démo sont liés seulement à `127.0.0.1` : `3004` pour l'API et `3005` pour le frontend. PostgreSQL n'a aucun port publié. Le nom de projet Compose `fab-demo` et le volume `demo_postgres_data` séparent la démo du déploiement principal.

Dans la configuration Caddy du VPS, ajouter ce bloc distinct et conserver intact le bloc du site principal :

```caddyfile
demo.familledaccueilbranchee.ca {
    header X-Robots-Tag "noindex, nofollow"
    handle /api/* {
        reverse_proxy 127.0.0.1:3004
    }
    handle {
        reverse_proxy 127.0.0.1:3005
    }
}
```

Valider Caddy avant de le recharger : `caddy validate --config /etc/caddy/Caddyfile`, puis `systemctl reload caddy`. Caddy obtiendra le certificat HTTPS lorsque le DNS pointera vers le VPS.

## Démarrer ou mettre à jour la démo

Depuis `/root/fab-demo` sur le VPS, après la sauvegarde GestionVPS validée :

```bash
docker compose --env-file .env.demo -f docker-compose.demo.yml build api-demo frontend-demo
docker compose --env-file .env.demo -f docker-compose.demo.yml up -d postgres-demo
docker compose --env-file .env.demo -f docker-compose.demo.yml run --rm api-demo npx prisma migrate deploy
docker compose --env-file .env.demo -f docker-compose.demo.yml run --rm api-demo npm run prisma:seed-demo
docker compose --env-file .env.demo -f docker-compose.demo.yml up -d api-demo frontend-demo
```

Le seed est répétable : il met à jour les six profils fictifs sans effacer les visites en cours. Il refuse de s'exécuter si `DEMO_MODE` n'est pas activé ou si la base ne s'appelle pas `fab_demo`.

Pour un aperçu local sur Windows, ajouter `-f docker-compose.demo.local.yml` à chaque commande Compose ci-dessus. L'adresse devient `http://localhost:3005/` et l'API `http://localhost:3004/api/v1`. Ce fichier d'ajustement ne doit pas être utilisé sur le VPS.

## Vérifier avant une sortie

- Ouvrir `https://demo.familledaccueilbranchee.ca/` sur un téléphone et sur l'appareil de présentation.
- Vérifier la bannière **Démonstration**, puis entrer dans la démo sur les deux appareils. Chaque visite doit avoir une adresse de compte temporaire différente dans **Mon profil**.
- Rechercher `H2X`, ouvrir le profil d'un allié, puis afficher **Messages**. Une conversation d'accueil fictive doit être présente.
- Vérifier qu'aucun paiement ou courriel n'est proposé. Tester le code QR avec la connexion mobile qui sera utilisée sur place.
- Vérifier que le site principal `https://familledaccueilbranchee.ca/` fonctionne toujours indépendamment.

Pour arrêter uniquement la démo : `docker compose --env-file .env.demo -f docker-compose.demo.yml down`. Ne pas utiliser `down -v` : cette option supprimerait sa base de données.
