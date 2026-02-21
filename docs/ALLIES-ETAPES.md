# Parcours alliés — Étapes

Document de planification du parcours d’inscription et de gestion des **alliés** (personnes qui offrent du soutien : ménage, gardiens, autres). À mettre à jour au fur et à mesure.

---

## Terminologie : ressource → allié

**À ne pas oublier** : partout où l’utilisateur voit le mot « ressource », le remplacer par **« allié »**.

- **Frontend** : textes, titres, boutons, messages (onboarding, inscription, recherche, fiche profil, espace « Me », admin si affiché).
- **Docs** : ce fichier et les autres docs métier utilisent déjà « allié » ; vérifier README, DEPLOI, etc. si « ressource » y figure.
- **Backend / base de données** : le rôle reste `RESOURCE` et les modèles `ResourceProfile`, etc. pour limiter les changements techniques ; seuls les **libellés** exposés à l’utilisateur deviennent « allié ».

---

## Contexte actuel (résumé)

- Inscription avec rôle **RESOURCE** : formulaire (email, mot de passe, nom, code postal, ville, région, bio, tags) → compte + `ResourceProfile` créés, état **PENDING_PAYMENT**.
- Ensuite : étape « Payer les frais d’inscription » (Stripe). Après paiement → **PENDING_VERIFICATION**.
- **Objectif** : inscription **gratuite** pour les alliés, choix du **type** (Ménage, Gardiens, Autres), puis **questionnaire** et **demande de vérification d’antécédents judiciaires**.

---

## Étapes du parcours allié

### Étape 1 — Choix du type d’allié (priorité haute) ✅ — Terminée

**Objectif** : Dès le début, l’allié choisit son type : **Ménage**, **Gardiens**, **Autres**.

**Livrables** :
- [x] Backend : champ **allyType** sur `ResourceProfile` (enum `AllyType` : `MENAGE` | `GARDIENS` | `AUTRES`). Migration `add_ally_type`.
- [x] Backend : `RegisterDto.allyType` (optionnel, validé si role = RESOURCE) ; `AuthService.register` exige allyType pour RESOURCE et le persiste sur `ResourceProfile`.
- [x] Frontend : sur la page d’inscription allié, **sélecteur de type** en premier (boutons Ménage / Gardiens / Autres). Titre « Inscription allié », bouton « Créer mon compte allié ». Envoi de `allyType` dans le body de l’inscription.

---

### Étape 2 — Inscription gratuite et remplacement « ressource » par « allié » (priorité haute)

**Objectif** : Plus de paiement pour les alliés ; après inscription, passage direct en attente de validation. Renommer tout ce qui est « ressource » en « allié » côté utilisateur.

**Livrables** :
- [ ] Backend : à l’inscription (rôle RESOURCE), mettre `onboardingState: PENDING_VERIFICATION` (et statuts de vérification/publication adaptés) au lieu de `PENDING_PAYMENT`. Inscription 100 % gratuite.
- [ ] Frontend — page « Premiers pas » (`/onboarding`) : carte « Ressource » → **« Allié »** ; texte du type « Créer un compte allié, inscription gratuite ».
- [ ] Frontend — page inscription (`/onboarding/resource`) : titre **« Inscription allié »** ; bouton **« Créer mon compte allié »** ; **supprimer** le bloc « Payer les frais d’inscription » et le bouton Stripe. Message de succès : « Compte allié créé. Vous pouvez compléter votre profil et attendre la validation. »
- [ ] Frontend : remplacer « ressource » par « allié » partout où c’est visible (recherche, fiche détail `/resource/[id]`, espace « Me », etc.). Voir section Terminologie ci-dessus.

---

### Étape 3 — Questionnaire allié (priorité moyenne)

**Objectif** : Un questionnaire à remplir par l’allié (après inscription ou sur la même page). Contenu à préciser.

**Livrables** :
- [ ] Définir le contenu du questionnaire (questions, champs).
- [ ] Backend : modèle ou champs pour stocker les réponses (ex. table dédiée ou JSON sur le profil allié). Migration si besoin.
- [ ] Backend : endpoint(s) pour enregistrer / récupérer les réponses du questionnaire.
- [ ] Frontend : section ou page « Questionnaire » dans le parcours allié (même page d’inscription ou page suivante après création de compte).

---

### Étape 4 — Vérification d’antécédents judiciaires (priorité moyenne)

**Objectif** : Informer l’allié qu’une vérification d’antécédents judiciaires est requise ; enregistrer la demande ou l’engagement.

**Livrables** :
- [ ] Backend : champ(s) pour le **statut** de la vérification (ex. `non_demandee` | `demandee` | `en_attente` | `recue`) sur le profil allié (ou table liée). Migration si besoin.
- [ ] Frontend : texte explicatif + **case à cocher** « Je m’engage à fournir une vérification d’antécédents judiciaires » (obligatoire pour valider l’inscription ou pour passer en « vérifié » selon les règles métier).
- [ ] (Optionnel) Plus tard : étape dédiée « Demande de vérification » (lien partenaire, formulaire, upload) et suivi du statut côté admin.

---

## Ordre de réalisation suggéré

1. **Étape 1** — Choix du type (Ménage, Gardiens, Autres) en base + dans le formulaire.
2. **Étape 2** — Inscription gratuite + remplacement « ressource » → « allié » partout dans l’UI.
3. **Étape 3** — Questionnaire (contenu puis stockage + UI).
4. **Étape 4** — Vérification antécédents judiciaires (engagement + statut).

---

## Révision

- **Création** : 2026-02-20  
- **Dernière mise à jour** : 2026-02-20

Cocher les cases `[ ]` au fur et à mesure.
