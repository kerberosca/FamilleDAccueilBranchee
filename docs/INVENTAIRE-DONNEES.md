# Inventaire des catégories de renseignements personnels — FAB

Document interne — Forméduc / FAB. Conformité Loi 25 (§6.8). La politique de confidentialité publiée sur le site reflète cet inventaire de façon lisible pour les utilisateurs.

---

## 1. Données des familles (comptes famille)

| Élément | Détail |
|--------|--------|
| **Nature** | Identité (nom affiché), contact (courriel), authentification (mot de passe hashé), localisation (code postal, ville, région), profil (bio, besoins / tags), disponibilités, informations d'abonnement (Stripe, statut). |
| **Support** | Base de données (PostgreSQL), hébergée au Canada (Toronto, Vultr). |
| **Finalité** | Création et gestion du compte ; mise en relation avec les alliés ; publication du profil selon les règles du site ; gestion des messages ; administration et modération. |
| **Destinataires** | Alliés (informations des familles avec lesquelles ils sont en conversation) ; administrateur (accès complet pour modération et support). |
| **Durée de conservation** | Tant que le compte est actif. À la demande de suppression : suppression sous 30 jours, sauf données à conserver en vertu de la loi ou anonymisées à des fins statistiques. |

---

## 2. Données des alliés (comptes ressource)

| Élément | Détail |
|--------|--------|
| **Nature** | Identité (nom affiché), contact (courriel, optionnellement téléphone/email de contact), authentification (mot de passe hashé), localisation (code postal, ville, région), profil (bio, compétences, tarif horaire, type d'allié), réponses au questionnaire, statut de vérification d'antécédents, disponibilités, statuts de modération (vérification, publication). |
| **Support** | Base de données (PostgreSQL), hébergée au Canada (Toronto, Vultr). |
| **Finalité** | Création et gestion du compte ; publication du profil dans le répertoire ; mise en relation avec les familles ; gestion des messages ; vérification et modération ; administration du site. |
| **Destinataires** | Familles avec abonnement actif (profils publics des alliés : nom, ville, région, code postal, compétences, tarif, bio, coordonnées si visibles) ; administrateur (accès complet). |
| **Durée de conservation** | Tant que le compte est actif. À la demande de suppression : suppression sous 30 jours, sauf exceptions légales ou données anonymisées. |

---

## 3. Messages (échanges entre utilisateurs)

| Élément | Détail |
|--------|--------|
| **Nature** | Contenu des messages, identifiants des conversations (famille, allié), date d'envoi. |
| **Support** | Base de données (PostgreSQL), hébergée au Canada (Toronto, Vultr). |
| **Finalité** | Permettre les échanges entre familles et alliés dans le cadre de la mise en relation ; modération et support si nécessaire. |
| **Destinataires** | Participants à la conversation ; administrateur (modération, support). |
| **Durée de conservation** | Liée au compte. Suppression avec le compte (sous 30 jours après demande), sauf conservation légale. |

---

## 4. Cookies et session

| Élément | Détail |
|--------|--------|
| **Nature** | Cookie de session (ex. refresh_token) pour maintenir la connexion. |
| **Support** | Navigateur de l'utilisateur ; serveur (token hashé en base). |
| **Finalité** | Authentification et fonctionnement du site (strictement nécessaire). |
| **Destinataires** | Non partagé avec des tiers. |
| **Durée** | Session / 30 jours (refresh), selon configuration technique. |

---

## 5. Logs techniques (si applicables)

| Élément | Détail |
|--------|--------|
| **Nature** | Adresses IP, logs d'accès, erreurs (selon configuration du serveur). |
| **Support** | Serveur / hébergeur (Vultr, Toronto). |
| **Finalité** | Sécurité, dépannage, preuve en cas d'incident. |
| **Destinataires** | Équipe technique / administrateur. |
| **Durée** | À définir selon politique interne (ex. 90 jours à 1 an), en cohérence avec la politique de confidentialité si ces données sont mentionnées. |

---

## Cohérence avec la politique de confidentialité

La page **Politique de confidentialité** (/confidentialite) décrit ces catégories de données, les finalités, qui y a accès, la durée de conservation et les droits des personnes. Cet inventaire doit être tenu à jour en cas d'ajout de nouvelles catégories de données ou de finalités, et la politique mise à jour en conséquence.

---

*Document interne. Dernière mise à jour : février 2025.*
