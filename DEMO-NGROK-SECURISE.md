# Démo Docker sur ngrok de manière sécurisée

Ce guide permet d’exposer ton application (Docker) via ngrok en limitant les accès et les risques.

---

## Lancement rapide (tout-en-un)

À la racine du projet, exécute :

```powershell
.\demarrage-demo-ngrok.ps1
```

Le script : crée le fichier de policy ngrok (auth démo), démarre Docker (postgres + api + frontend), ouvre **deux fenêtres** pour les tunnels ngrok (API et frontend). Il affiche ensuite les étapes à faire à la main (noter les URLs, mettre à jour CORS dans `.env`, redémarrer l’API, lancer le frontend avec l’URL de l’API). Identifiants par défaut pour le frontend : **demo** / **FabDemo2025!** (modifiable dans `ngrok-demo-policy.yml`).

---

## Mesures de sécurité

| Mesure | Rôle |
|--------|------|
| **Authentification sur le frontend** | Seules les personnes qui ont le login/mot de passe peuvent ouvrir la démo. |
| **CORS sur l’API** | L’API n’accepte les requêtes que depuis l’URL du frontend (ngrok), pas depuis n’importe quel site. |
| **Pas d’exposition de Postgres** | Aucun tunnel sur le port 5432 : la base reste locale. |
| **HTTPS** | ngrok fournit HTTPS ; pas de mot de passe en clair sur le réseau. |
| **Tunnels temporaires** | Tu n’ouvres les tunnels que pendant la démo, puis tu les fermes. |

---

## 1. Prérequis

- Docker et docker-compose installés.
- [ngrok](https://ngrok.com/download) installé et configuré (`ngrok config add-authtoken TON_TOKEN`).
- Un mot de passe fort pour la démo (ex. généré avec un gestionnaire de mots de passe). On l’utilisera pour l’auth du **frontend** uniquement.

---

## 2. Démarrer l’app en Docker

À la racine du projet :

```bash
docker-compose up -d postgres api frontend
```

Attends que l’API et le frontend soient prêts (quelques dizaines de secondes). Vérifie en local :

- Frontend : http://localhost:3002  
- API : http://localhost:3000/api/v1/health  

**Important :** ne crée **jamais** de tunnel ngrok vers le port **5432** (Postgres). La base ne doit pas être exposée sur internet.

---

## 3. Lancer les tunnels ngrok (sécurisés)

Tu vas ouvrir **deux tunnels** : un pour l’API (sans auth, mais protégé par CORS), un pour le frontend **avec authentification**.

### Option A : Fichier de config ngrok (recommandé)

1. Copie le fichier d’exemple et adapte le mot de passe :

   ```bash
   copy ngrok-demo.example.yml ngrok-demo-policy.yml
   ```

2. Édite `ngrok-demo-policy.yml` : remplace `DEMO_PASSWORD_ICI` par un vrai mot de passe (et optionnellement le nom d’utilisateur `demo`).

3. Lance les deux tunnels. Pour le frontend, utilise le fichier de policy (basic auth) :

   **Terminal 1 – API (pas d’auth, CORS fera le filtre côté app)**  
   ```bash
   ngrok http 3000
   ```
   Note l’URL HTTPS affichée (ex. `https://abc123.ngrok-free.app`) → **URL_API**.

   **Terminal 2 – Frontend (avec basic auth)**  
   ```bash
   ngrok http 3002 --traffic-policy-file=ngrok-demo-policy.yml
   ```
   Note l’URL HTTPS (ex. `https://def456.ngrok-free.app`) → **URL_FRONTEND**.

### Option B : Sans fichier (auth en ligne de commande)

**Terminal 1 – API**  
```bash
ngrok http 3000
```

**Terminal 2 – Frontend avec login/mot de passe**  
Remplace `demo` et `TonMotDePasseFort` par tes valeurs (pas d’espace autour du `:`).

```bash
ngrok http 3002 --basic-auth="demo:TonMotDePasseFort"
```

Sous PowerShell, si le mot de passe contient des caractères spéciaux, utilise des guillemets et échappe si besoin :

```powershell
ngrok http 3002 --basic-auth="demo:MonMotDePasse123!"
```

Dès que quelqu’un ouvre l’URL du frontend, le navigateur demandera **Identifiant** et **Mot de passe** avant d’afficher l’app.

---

## 4. Configurer le backend (CORS)

L’API doit accepter les requêtes venant **uniquement** de ton URL frontend ngrok (et éventuellement localhost pour toi).

Dans ton `.env` à la racine, mets à jour `CORS_ORIGINS` (remplace par ton **URL_FRONTEND** réelle, sans slash final) :

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3002,https://def456.ngrok-free.app
```

Puis redémarre l’API pour prendre en compte le changement :

```bash
docker-compose restart api
```

---

## 5. Configurer le frontend (URL de l’API)

Le frontend en Docker utilise une variable d’environnement pour l’API. Il faut le reconstruire/lancer avec l’URL **publique** de l’API (ton tunnel ngrok).

**Option simple :** arrêter le frontend Docker et le lancer à la main avec l’URL d’API publique, pour ne pas avoir à rebuild l’image à chaque changement d’URL.

1. Arrête uniquement le frontend :

   ```bash
   docker-compose stop frontend
   ```

2. Dans un terminal, depuis la racine du projet (remplace par ton **URL_API** ngrok) :

   **PowerShell :**
   ```powershell
   cd frontend
   $env:NEXT_PUBLIC_API_URL="https://abc123.ngrok-free.app/api/v1"
   npm run dev
   ```

   **CMD :**
   ```cmd
   cd frontend
   set NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app/api/v1
   npm run dev
   ```

Tu gardes `postgres` et `api` en Docker ; seul le frontend tourne en local avec la bonne URL d’API.

**Option tout Docker :** tu peux aussi passer `NEXT_PUBLIC_API_URL` au service `frontend` dans `docker-compose` (ou un override) avec l’URL ngrok de l’API, puis `docker-compose up -d frontend`. Il faudra alors redémarrer le frontend à chaque fois que l’URL ngrok change (gratuit = URL change à chaque session).

---

## 6. Donner l’accès au client

Envoie au client **un seul lien** : l’**URL du frontend** (Terminal 2), par ex. :

```
https://def456.ngrok-free.app
```

Et communique‑lui **par un autre canal** (téléphone, autre messagerie) :

- **Identifiant :** `demo` (ou celui que tu as choisi)
- **Mot de passe :** celui que tu as mis dans `--basic-auth` ou dans `ngrok-demo.yml`

Il ouvre le lien, entre le login/mot de passe une fois, et utilise la démo. **Ne partage pas l’URL de l’API** : elle n’est utile que pour ton frontend ; la limiter évite les abus.

---

## 7. Après la démo

- Ferme les deux fenêtres ngrok (Ctrl+C dans chaque terminal).
- Si tu as lancé le frontend à la main, arrête-le (Ctrl+C) et relance le frontend en Docker si besoin :  
  `docker-compose up -d frontend`
- Tu peux laisser `docker-compose` tourner ou tout arrêter :  
  `docker-compose down`

---

## Résumé des URLs et de la config

| Élément | Valeur / action |
|--------|------------------|
| **URL API (ngrok)** | Ex. `https://abc123.ngrok-free.app` → à mettre dans `NEXT_PUBLIC_API_URL` + `/api/v1` |
| **URL Frontend (ngrok)** | Ex. `https://def456.ngrok-free.app` → à envoyer au client + à ajouter dans `CORS_ORIGINS` |
| **Auth frontend** | Basic auth sur le tunnel frontend (`--basic-auth="demo:MotDePasse"` ou policy file) |
| **Postgres** | Jamais exposé sur ngrok |

Avec ça, ton application Docker est exposée sur ngrok de manière **sécurisée** pour une démo (auth sur le frontend, CORS sur l’API, pas de base exposée).
