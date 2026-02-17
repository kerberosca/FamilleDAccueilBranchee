# Déploiement : banc de test (Windows) → GitHub → VPS (Linux)

Objectif : **tester vite en local** et, quand c’est bon, **déployer sur le VPS** en étant sûr que ce qui marche en test marchera aussi en prod (même build Linux).

---

## Avant de commencer (une fois)

- **GitHub** : crée un repo (ex. `FamilleDAccueilBranchee`) sur ton compte [kerberosca](https://github.com/kerberosca/), puis associe ton projet local et pousse la branche `main`. Aucun secret à configurer pour l’instant : le workflow « Build prod » utilise seulement le code du repo.
- **VPS** : accès SSH (utilisateur + IP ou clé). Le projet sera cloné depuis GitHub.

---

## Vue d’ensemble

| Où | Outil | Rôle |
|----|--------|------|
| **PC (Windows)** | Docker Desktop | Conteneurs **Linux** : même environnement que le VPS. Tests rapides en dev, puis vérification du build prod. |
| **GitHub** | Repo + Actions | Stockage du code + vérification automatique que le **build prod** passe sur Linux. |
| **VPS (Linux)** | Docker | Même `docker-compose.prod.yml` : pull du code depuis GitHub, puis build et run. |

---

## Étape 1 — Tests rapides sur ton PC (quotidien)

À la racine du projet :

```powershell
docker compose up -d
```

- API : http://localhost:3000  
- Frontend : http://localhost:3002  
- Postgres : dans le conteneur

Tu codes, tu testes. Les conteneurs tournent sous **Linux** (Docker Desktop), donc le comportement est proche du VPS.

Pour tout arrêter :

```powershell
docker compose down
```

---

## Étape 2 — Vérifier que le build prod passe (avant de déployer)

Sur ton PC, lance le **même** build que sur le VPS (toujours en Linux via Docker) :

```powershell
docker compose -f docker-compose.prod.yml build
```

- Si ça termine sans erreur → le code est prêt pour le VPS.
- Si ça échoue → corrige, puis refais cette commande.

Ensuite, pousse sur GitHub (étape 3).

---

## Étape 3 — Pousser sur GitHub

Quand les tests sont ok et que le build prod a réussi (étape 2) :

**Première fois** (si le projet n’est pas encore lié au repo) :
```powershell
git remote add origin https://github.com/kerberosca/FamilleDAccueilBranchee.git
git push -u origin main
```

**Ensuite**, à chaque déploiement :
```powershell
git add .
git commit -m "ton message"
git push origin main
```

Sur GitHub, l’onglet **Actions** exécute le workflow **« Build prod (Linux) »** (fichier `.github/workflows/build-prod.yml`) : il refait le build prod sur Linux. Si c’est vert, le VPS pourra builder sans surprise.

---

## Étape 4 — Déployer sur le VPS (une fois le repo prêt)

### 4.1 Première fois sur le VPS

1. Connexion SSH au VPS (remplace l’IP si besoin) :
   ```bash
   ssh root@155.138.159.183
   ```

2. Cloner le projet (repo : [github.com/kerberosca](https://github.com/kerberosca/)) :
   ```bash
   cd ~
   git clone https://github.com/kerberosca/FamilleDAccueilBranchee.git fab
   cd fab
   ```

3. Créer le fichier `.env` (copie de `.env.example`, avec les vrais mots de passe et l’URL du VPS). Voir la section « Variables d’environnement » plus bas.

4. Lancer les conteneurs et les migrations :
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
   ```

### 4.2 Déploiements suivants (mise à jour)

Sur le VPS :

```bash
cd ~/fab
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

Si tu as des migrations Prisma :

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

---

## Variables d’environnement (VPS)

Dans le `.env` sur le VPS, adapte au moins :

- `POSTGRES_PASSWORD` et la partie mot de passe dans `DATABASE_URL`
- `NEXT_PUBLIC_API_URL` = `http://155.138.159.183:3000/api/v1` (ou ton domaine)
- `APP_FRONTEND_URL`, `CORS_ORIGINS`, `JWT_*`, `ADMIN_*`

Tu peux t’inspirer de `.env.example` à la racine du projet.

---

## Résumé des commandes

| Action | Commande (PC) | Commande (VPS) |
|--------|----------------|----------------|
| Lancer les tests (dev) | `docker compose up -d` | — |
| Vérifier le build prod | `docker compose -f docker-compose.prod.yml build` | — |
| Déployer / mettre à jour | `git push origin main` | `cd ~/fab && git pull && docker compose -f docker-compose.prod.yml up -d --build` |

---

## Dépannage

- **Le build prod échoue en local** : corrige les erreurs (TypeScript, imports, etc.) puis refais `docker compose -f docker-compose.prod.yml build`.
- **Le build échoue sur le VPS** : vérifie que le code sur le VPS est à jour (`git pull`) et que le workflow GitHub « Build prod » est vert (build Linux identique).
- **Fichiers sensibles** : ne jamais commiter `.env` ; le garder seulement sur le PC et sur le VPS.
