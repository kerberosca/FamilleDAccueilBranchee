# Remettre le VPS à neuf

Connecte-toi au VPS en SSH (PuTTY ou PowerShell : `ssh -i ta_cle root@155.138.159.183`), puis exécute les commandes ci-dessous.

## 1. Arrêter et supprimer les conteneurs Docker

Si le projet est dans `~/fab/Projets/FamilleDAccueilBranchee` :

```bash
cd ~/fab/Projets/FamilleDAccueilBranchee
docker compose -f docker-compose.prod.yml down -v
```

`-v` supprime aussi les **volumes** (base de données incluse) pour repartir vraiment à zéro.

Si le chemin est différent, adapte le `cd` (ex. `cd ~/fab` si tu avais tout dans `~/fab`).

## 2. Supprimer le dossier du projet (optionnel)

Pour tout enlever (code + .env) :

```bash
cd ~
rm -rf ~/fab
```

Ou seulement le sous-dossier du projet :

```bash
rm -rf ~/fab/Projets/FamilleDAccueilBranchee
```

## 3. Supprimer l’archive de déploiement (si elle existe)

```bash
rm -f ~/fab-deploy.zip
```

## 4. (Optionnel) Nettoyer Docker (images, cache)

Pour libérer de la place et repartir sans anciennes images :

```bash
docker system prune -a -f
```

Attention : cela supprime **toutes** les images et conteneurs Docker sur le VPS, pas seulement FAB.

---

## Résumé tout-en-un (copier-coller)

À exécuter après connexion SSH au VPS :

```bash
cd ~/fab/Projets/FamilleDAccueilBranchee 2>/dev/null && docker compose -f docker-compose.prod.yml down -v
cd ~
rm -rf ~/fab
rm -f ~/fab-deploy.zip
```

Si le dossier n’est pas à cet endroit, modifie la première ligne ou lance seulement :

```bash
docker compose -f docker-compose.prod.yml down -v
```

depuis le dossier où se trouve `docker-compose.prod.yml`.
