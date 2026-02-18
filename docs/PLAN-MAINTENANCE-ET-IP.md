# Planification : mode maintenance et contrôle d’accès par IP

Objectif : permettre de mettre l’application en **maintenance** (message dédié, pas d’usage normal) et de **restreindre l’accès par adresse IP** (whitelist / blacklist). Ce document décrit les options, le périmètre et les étapes pour les deux fonctionnalités.

---

## 1. Mode maintenance

### 1.1 Comportement attendu

- **Quand la maintenance est activée** :
  - Les utilisateurs (frontend) voient une page « Site en maintenance » au lieu de l’app.
  - L’API renvoie un statut **503 Service Unavailable** (ou une réponse dédiée) pour les routes métier, sauf éventuellement une route de santé ou une route admin pour désactiver la maintenance.
- **Quand la maintenance est désactivée** : comportement normal.

### 1.2 Où activer la maintenance ?

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **A. Variable d’environnement** (`MAINTENANCE_MODE=true`) | Simple, pas de code métier, redémarrage du conteneur pour changer. | Il faut redéployer ou redémarrer pour activer/désactiver. |
| **B. Fichier sur le disque** (ex. `maintenance.on` dans un volume) | Activer/désactiver sans redémarrage : créer/supprimer le fichier depuis le VPS. | Gestion des droits et du chemin (volume Docker). |
| **C. Route admin + stockage en base ou en mémoire** | Désactivation possible depuis l’interface admin. | Plus complexe, nécessite une route protégée et un mécanisme de persistance. |

**Recommandation pour démarrer** : **A** (env) ou **B** (fichier). **C** en évolution si tu veux basculer depuis l’admin sans toucher au serveur.

**Implémenté (option C)** : route admin + persistance en base (`MaintenanceState`), guard global qui renvoie 503 sauf pour `/health`, `/maintenance/*` et les requêtes avec un JWT admin. Console admin avec boutons Activer / Désactiver ; page frontend « Site en maintenance » avec lien vers /admin. Au premier déploiement : `npx prisma migrate deploy` (migration `20260214000000_add_maintenance_state`).

### 1.3 Où implémenter ?

- **API (NestJS)**  
  - Middleware global (ou guard) qui vérifie si la maintenance est active.  
  - Si oui : renvoyer **503** avec un JSON du type `{ "statusCode": 503, "message": "Maintenance en cours" }`.  
  - Exceptions possibles : `GET /api/v1/health` (pour les load balancers / Caddy) et, si tu choisis l’option C, une route admin du type `POST /api/v1/admin/maintenance/off`.

- **Frontend (Next.js)**  
  - Si l’API renvoie 503 (ou un code dédié) sur une requête « globale » (ex. au chargement de l’app ou sur une route dédiée `/api/maintenance-status`), afficher une page **« Site en maintenance »** au lieu du contenu normal (redirection ou composant full-page).  
  - Éviter de laisser l’utilisateur sur l’app qui ne fait que renvoyer des 503 partout.

- **Caddy (VPS)**  
  - Optionnel : si `MAINTENANCE_MODE` est géré côté VPS (script qui redémarre Caddy avec une config différente), Caddy peut servir une page HTML statique « Maintenance » et renvoyer 503 pour le domaine.  
  - À prévoir seulement si tu veux une page de maintenance **sans** passer par le frontend Next.js (ex. pendant une mise à jour complète des conteneurs).

### 1.4 Étapes proposées (mode maintenance)

1. **Config**  
   - Ajouter une variable d’environnement (ex. `MAINTENANCE_MODE=false`) et, si choix B, définir le chemin du fichier (ex. `MAINTENANCE_FILE_PATH`).
2. **API**  
   - Créer un **middleware** (ou guard) « maintenance » qui lit l’env (ou la présence du fichier) et renvoie 503 pour toutes les routes sauf santé (et éventuellement admin/maintenance).
3. **Frontend**  
   - Détecter 503 (ou appeler une route dédiée) et afficher une page « Site en maintenance » (layout simple, pas de menu métier).
4. **Documentation**  
   - Documenter dans le runbook / DEPLOI comment activer/désactiver (env ou fichier) et, si besoin, la config Caddy.

---

## 2. Contrôle d’accès par adresse IP

### 2.1 Comportement attendu

- **Whitelist** : n’autoriser que certaines IP (ou plages) à accéder au site / à l’API.  
- **Blacklist** : bloquer certaines IP (ou plages).  
- Au moins l’un des deux (whitelist ou blacklist) doit être configurable (fichier ou env).

### 2.2 Où appliquer le filtre IP ?

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **A. Firewall (UFW / nftables) sur le VPS** | Blocage au plus bas niveau, performant, s’applique à tous les services (Caddy, etc.). | Gestion manuelle ou par script ; pas de « par route » ; risque de se bloquer soi-même (toujours autoriser son IP admin). |
| **B. Caddy** | Règles par site/route, pas de redémarrage de l’API. Caddy peut utiliser `remote_ip` pour autoriser/refuser. | Il faut éditer la config Caddy sur le VPS (ou la générer depuis un script). |
| **C. NestJS (middleware / guard)** | Règles par route possibles (ex. whitelist admin uniquement sur `/api/v1/admin`). | L’IP vue par Nest peut être celle du reverse proxy (X-Forwarded-For) ; il faut faire confiance à Caddy et bien parser l’en-tête. |

**Recommandation** :  
- **Whitelist globale** (tout le site) : **A** (UFW) ou **B** (Caddy).  
- **Whitelist admin** (seulement certaines routes, ex. `/api/v1/admin`) : **C** (NestJS) avec une liste d’IP en env (ex. `ADMIN_IP_WHITELIST=1.2.3.4,5.6.7.8`).

### 2.3 Détails techniques

- **IP réelle derrière Caddy** : Caddy doit transmettre l’IP client (souvent via `X-Forwarded-For` ou `X-Real-IP`). En NestJS, lire cet en-tête (en faisant confiance à Caddy) pour le guard IP.
- **Format de configuration** : liste d’IP séparées par des virgules, ou par ligne dans un fichier. Pour des plages, prévoir soit des CIDR (ex. `192.168.1.0/24`) soit une liste d’IP explicites au début.
- **Admin** : toujours s’assurer que l’IP depuis laquelle tu te connectes (SSH, admin) est autorisée avant d’activer une whitelist stricte.

### 2.4 Étapes proposées (accès par IP)

1. **Décider du périmètre**  
   - Whitelist globale (tout le site) vs whitelist/blacklist uniquement sur les routes admin (NestJS).
2. **Si whitelist globale (UFW ou Caddy)**  
   - Documenter la procédure (ex. règles UFW ou extrait Caddy avec `remote_ip`).  
   - Prévoir un script ou une checklist pour ne pas se bloquer (autoriser ton IP avant de restreindre).
3. **Si whitelist admin (NestJS)**  
   - Ajouter une variable d’environnement (ex. `ADMIN_IP_WHITELIST=1.2.3.4`) et un **guard** qui vérifie `X-Forwarded-For` / `X-Real-IP` sur les routes protégées admin. Si l’IP n’est pas dans la liste, renvoyer 403.
4. **Caddy**  
   - Vérifier que Caddy envoie bien l’IP client vers l’API (X-Forwarded-For). Configurer si besoin.
5. **Documentation**  
   - Runbook : comment ajouter/retirer une IP (UFW, Caddy ou env), et comment récupérer son IP en cas de blocage.

---

## 3. Ordre de réalisation suggéré

| Phase | Tâche | Priorité |
|-------|--------|----------|
| 1 | Mode maintenance : env + middleware 503 + exception santé (API) | 1 |
| 2 | Mode maintenance : page frontend « Site en maintenance » sur 503 | 2 |
| 3 | Documentation : activation/désactivation maintenance (runbook / DEPLOI) | 3 |
| 4 | Décision : whitelist globale (UFW/Caddy) vs whitelist admin (NestJS) | 4 |
| 5 | Implémentation du contrôle IP choisi + config Caddy (X-Forwarded-For si Nest) | 5 |
| 6 | Documentation : gestion des IP (runbook) | 6 |

---

## 4. Résumé des livrables

- **Mode maintenance**  
  - Variable (ou fichier) pour activer/désactiver.  
  - Middleware/guard API renvoyant 503 sauf santé (et évent. admin).  
  - Page frontend « Site en maintenance » lorsque 503 (ou route dédiée) est détectée.  
  - Doc : comment activer/désactiver.

- **Accès par IP**  
  - Soit règles UFW/Caddy (whitelist/blacklist globale).  
  - Soit guard NestJS sur routes admin avec liste d’IP en env.  
  - Caddy configuré pour transmettre l’IP client si on utilise Nest.  
  - Doc : comment gérer les IP et ne pas se bloquer.

Quand tu auras choisi (maintenance : A/B/C et IP : globale vs admin), on pourra détailler les étapes techniques fichier par fichier (middleware, guard, config Caddy, exemples de `.env`).
