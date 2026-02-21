# GitHub + VPS — Fiche rapide

Chaîne : **PC (Windows)** → **GitHub** → **VPS (Linux)**.

---

## En bref

| Étape | Où | Action |
|-------|-----|--------|
| 1 | PC | Tester : `docker compose up -d` |
| 2 | PC | Build prod : `docker compose -f docker-compose.prod.yml build` |
| 3 | PC | Pousser : `git add .` → `git commit -m "..."` → `git push origin main` |
| 4 | GitHub | Vérifier l’onglet **Actions** : workflow « Build prod (Linux) » doit être vert |
| 5 | VPS | Mise à jour : `cd ~/fab && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build` |

---

## Liens utiles

- **Déploiement complet** (première fois, variables d’env, migrations) : [DEPLOI-ETAPES.md](./DEPLOI-ETAPES.md)
- **Clé SSH pour le VPS** : [CREER-CLE-SSH.md](./CREER-CLE-SSH.md)
- **Remettre le VPS à neuf** : [VPS-REMETTRE-A-NEUF.md](./VPS-REMETTRE-A-NEUF.md)

---

## Première fois

- **GitHub** : repo `kerberosca/FamilleDAccueilBranchee`, remote déjà configuré → `git push -u origin main`.
- **VPS** : `ssh root@<IP>` puis cloner dans `~/fab`, créer `.env` depuis `.env.example`, lancer `docker compose -f docker-compose.prod.yml up -d --build` et `npx prisma migrate deploy` dans le conteneur API. Détails dans [DEPLOI-ETAPES.md](./DEPLOI-ETAPES.md).
