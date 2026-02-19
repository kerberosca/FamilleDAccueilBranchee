# Analyse des risques

Document d’analyse des risques pour l’application FAB (Famille d’accueil branchée). À mettre à jour lors de changements majeurs (sécurité, déploiement, fonctionnalités critiques).

---

## 1. Mode maintenance

### 1.1 Risques fonctionnels

| Risque | Gravité | Description | Mitigation |
|--------|---------|-------------|------------|
| Utilisateur resté sur la page maintenance après fin de maintenance | Moyenne | Sans refetch, l’utilisateur devait recharger la page pour revoir l’app. | **Mitigé** : refetch périodique (60 s) et au retour sur l’onglet (`visibilitychange`) dans `MaintenanceProvider`. |
| Utilisateur ne voit pas la page maintenance si elle est activée alors qu’il a déjà l’app ouverte | Moyenne | Il continuait à utiliser l’app jusqu’à F5 ou jusqu’à recevoir des 503. | **Mitigé** : refetch périodique + mise à jour du contexte dès qu’une requête API renvoie 503 (événement `fab-maintenance-503`). |
| Dernier admin se déconnecte ou perd son JWT pendant la maintenance | Haute | Plus personne ne peut désactiver la maintenance depuis l’UI. | S’assurer qu’au moins un admin reste connecté pendant la maintenance. **Runbook** : désactiver en base (`UPDATE maintenance_state SET enabled = false WHERE id = 'default'`) ou via script / accès direct DB. |
| Utilisateur avec rôle admin retiré garde l’accès tant que son JWT est valide | Faible | Jusqu’à expiration du token, il peut encore accéder aux routes admin (dont POST maintenance). | TTL court du JWT ; en cas d’urgence, runbook « révoquer session » ou redémarrage des secrets. |

### 1.2 Risques techniques

| Risque | Gravité | Description | Mitigation |
|--------|---------|-------------|------------|
| Base indisponible au démarrage de l’API | Haute | `MaintenanceService` lit/écrit en base ; si la DB est down, `isActive()` / `getState()` peuvent échouer. | Dépendance Postgres + healthcheck ; garder `/health` simple (éviter de dépendre de la table maintenance si possible). |
| Ordre d’application des guards | Moyenne | Si un autre guard bloquait avant le maintenance guard, le comportement pourrait diverger. | Guard maintenance en `APP_GUARD` ; vérifier qu’il s’exécute bien avant les guards métier. |
| Cache intermédiaire (proxy, CDN) sur GET /maintenance/status | Faible | Un proxy pourrait mettre en cache la réponse et retarder la mise à jour côté client. | Côté client : `cache: "no-store"`. Côté API : si un reverse proxy est ajouté, prévoir `Cache-Control: no-store` (ou `max-age=0`) sur cette route. |

### 1.3 Risques opérationnels

| Risque | Gravité | Description | Mitigation |
|--------|---------|-------------|------------|
| Activation maintenance par erreur | Moyenne | Tous les utilisateurs non-admin voient la page maintenance. | Message clair dans la console admin ; runbook « désactiver via admin ou en base ». |
| Maintenance longue sans retour utilisateur | Faible | Les utilisateurs ne savent pas quand réessayer. | Page maintenance avec message court ; refetch automatique toutes les 60 s et au retour sur l’onglet. |

---

## 2. Authentification et autorisation

| Risque | Gravité | Description | Mitigation |
|--------|---------|-------------|------------|
| Fuite ou vol de JWT | Haute | Accès indue aux comptes. | HTTPS obligatoire en prod ; JWT en mémoire (pas en localStorage si possible) ; TTL raisonnable ; refresh token en HTTP-only cookie si implémenté. |
| Élévation de rôle (accès admin) | Haute | Un utilisateur non-admin accède aux routes admin. | Guards `RolesGuard` + vérification du rôle côté API sur chaque route admin. |
| Bypass auth en dev | Moyenne | `DEV_BYPASS_AUTH` ou `/dev/login-as` exposés en prod. | Module dev non importé ou désactivé quand `NODE_ENV=production`. |

---

## 3. Données et persistance

| Risque | Gravité | Description | Mitigation |
|--------|---------|-------------|------------|
| Perte de données (DB) | Haute | Panne disque, corruption, mauvaise manipulation. | Sauvegardes régulières (scripts backup, voir `scripts/backup-db.sh`) ; tester la restauration. |
| Données sensibles en clair | Haute | Mots de passe, tokens stockés en clair. | Mots de passe hashés (bcrypt) ; secrets en variables d’environnement, jamais en repo. |
| Exposition de données (autre utilisateur) | Haute | Un utilisateur voit ou modifie les données d’un autre. | Vérification systématique des droits par ressource (ownership, rôle) dans les services. |

---

## 4. Déploiement et infrastructure

| Risque | Gravité | Description | Mitigation |
|--------|---------|-------------|------------|
| Build / déploiement différent de la prod | Moyenne | Comportement différent entre local et VPS. | Build prod identique (Docker Linux) ; workflow GitHub « Build prod » ; doc `docs/DEPLOI-ETAPES.md`. |
| Fichiers sensibles commités | Haute | `.env`, clés API, mots de passe dans le repo. | `.env` dans `.gitignore` ; pas de secrets dans le code ; rappel dans la doc. |
| VPS non mis à jour | Moyenne | Failles de sécurité non patchées. | Mises à jour système régulières ; surveillance des CVE. |

---

## 5. Divers

| Risque | Gravité | Description | Mitigation |
|--------|---------|-------------|------------|
| CORS trop permissif | Moyenne | Requêtes depuis des origines non autorisées. | `CORS_ORIGINS` configuré en prod pour les domaines attendus. |
| Logs contenant des données sensibles | Faible | Tokens, mots de passe dans les logs. | Ne pas logger le corps des requêtes auth ; audit logs sans contenu sensible. |
| Dépendances vulnérables | Moyenne | Vulnérabilités dans les paquets npm. | `npm audit` ; mise à jour régulière des dépendances. |

---

## Synthèse

- **Mode maintenance** : risques de rafraîchissement atténués par refetch périodique, `visibilitychange` et réaction au 503. Risque principal restant : plus d’admin connecté pour désactiver → runbook en base.
- **Auth / rôles** : guards et vérification côté API ; sécuriser les secrets et l’environnement de prod.
- **Données** : sauvegardes, hashing, contrôle d’accès par ressource.
- **Déploiement** : build reproductible, pas de secrets dans le repo.

Ce document peut être complété (nouvelles fonctionnalités, incidents) et relu à chaque release majeure ou incident.
