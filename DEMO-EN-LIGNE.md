# Mettre la démo en ligne depuis ton PC (tunnel)

Tu peux rendre ton projet (qui tourne sur ton ordi) accessible sur internet **le temps de la démo** grâce à un tunnel.

**Pour une démo Docker + ngrok avec authentification (login/mot de passe) et CORS :** voir **[DEMO-NGROK-SECURISE.md](DEMO-NGROK-SECURISE.md)**. Le client ouvre une URL publique ; les requêtes arrivent sur ta machine.

## Outil : ngrok (gratuit)

[ngrok](https://ngrok.com) crée une URL publique (ex. `https://abc123.ngrok.io`) qui pointe vers un port de ta machine.

1. **Installer ngrok**  
   - Télécharge : https://ngrok.com/download  
   - Ou avec Chocolatey : `choco install ngrok`  
   - Crée un compte gratuit sur ngrok.com et récupère ton authtoken, puis :  
     `ngrok config add-authtoken TON_TOKEN`

2. **Lancer ton projet** (backend + frontend + Postgres)  
   Depuis la racine du projet :
   ```bash
   docker-compose up -d postgres api
   ```
   Puis attends que l’API soit prête (healthcheck). Ensuite lance le frontend **à la main** (pour pouvoir lui passer l’URL publique de l’API) :
   ```bash
   cd frontend
   npm run dev
   ```
   (Tu peux aussi tout lancer avec `docker-compose up` et faire uniquement le frontend en local pour la démo.)

3. **Ouvrir deux tunnels**  
   Dans **deux terminaux séparés** :

   **Terminal 1 – API (port 3000)**  
   ```bash
   ngrok http 3000
   ```
   Note l’URL affichée, par ex. : `https://a1b2c3d4.ngrok-free.app` → c’est ton **URL API publique**.

   **Terminal 2 – Frontend (port 3002)**  
   ```bash
   ngrok http 3002
   ```
   Note l’URL affichée, par ex. : `https://e5f6g7h8.ngrok-free.app` → c’est l’**URL à envoyer au client**.

4. **Configurer le backend (CORS)**  
   L’API doit accepter les requêtes venant de l’URL du frontend (ngrok). Dans ton fichier `.env` à la racine, mets à jour `CORS_ORIGINS` pour inclure l’URL **frontend** (celle que le client ouvre) :
   ```env
   CORS_ORIGINS=http://localhost:3000,http://localhost:3002,https://e5f6g7h8.ngrok-free.app
   ```
   Remplace `e5f6g7h8.ngrok-free.app` par l’URL réelle de ton tunnel **frontend**.  
   Redémarre le conteneur API pour prendre en compte le nouveau `.env` :
   ```bash
   docker-compose restart api
   ```

5. **Configurer le frontend (URL de l’API)**  
   Le navigateur du client doit appeler l’**API publique** (tunnel API), pas localhost. Relance le frontend en lui passant l’URL de l’API :
   ```bash
   cd frontend
   set NEXT_PUBLIC_API_URL=https://a1b2c3d4.ngrok-free.app/api/v1
   npm run dev
   ```
   (Sous PowerShell : `$env:NEXT_PUBLIC_API_URL="https://a1b2c3d4.ngrok-free.app/api/v1"; npm run dev`.)  
   Remplace `a1b2c3d4.ngrok-free.app` par l’URL réelle de ton tunnel **API**.

6. **Donner l’URL au client**  
   Envoie au client l’URL du tunnel **frontend** (celle du terminal 2), par ex. :  
   `https://e5f6g7h8.ngrok-free.app`  
   Il pourra utiliser la démo tant que :
   - ton PC est allumé,
   - `docker-compose` (api + postgres) et le frontend tournent,
   - les deux tunnels ngrok sont ouverts.

---

## Résumé des URLs

| Rôle        | Exemple d’URL (à adapter)        | Où l’utiliser |
|------------|-----------------------------------|----------------|
| API publique | `https://a1b2c3d4.ngrok-free.app` | `NEXT_PUBLIC_API_URL` = cette URL + `/api/v1` |
| Frontend (pour le client) | `https://e5f6g7h8.ngrok-free.app` | À envoyer au client |
| CORS (backend) | `https://e5f6g7h8.ngrok-free.app` | Ajouter dans `CORS_ORIGINS` dans `.env` |

---

## Alternative : Cloudflare Tunnel (sans compte ngrok)

Si tu préfères ne pas utiliser ngrok :

1. Télécharge **cloudflared** : https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Tunnel API : `cloudflared tunnel --url http://localhost:3000`
3. Tunnel frontend : dans un autre terminal : `cloudflared tunnel --url http://localhost:3002`
4. Utilise les URLs affichées (type `https://xxx.trycloudflare.com`) comme ci‑dessus pour `NEXT_PUBLIC_API_URL` et `CORS_ORIGINS`.

---

## Sécurité

- C’est une **démo temporaire** : dès que tu fermes les tunnels (et/ou l’app), plus personne n’y a accès.
- En gratuit, ngrok peut afficher une page d’avertissement la première fois qu’on ouvre l’URL ; le client clique sur « Visit Site ».
- Ne laisse pas les tunnels ouverts en permanence si tu n’en as pas besoin.
