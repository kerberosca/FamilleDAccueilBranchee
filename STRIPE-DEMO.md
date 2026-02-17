# Comment fonctionne Stripe dans ta démo

Stripe gère **deux types de paiement** dans FAB :

1. **Ressource** : un **paiement unique** (frais d’inscription) pour devenir ressource.
2. **Famille** : un **abonnement** récurrent pour activer le profil famille.

---

## Vue d’ensemble du flux

```
[Frontend]                    [Ton API NestJS]                 [Stripe]
    |                                |                             |
    |  POST /billing/.../checkout-session (JWT)                     |
    | ------------------------------>|                             |
    |                                |  crée une Checkout Session   |
    |                                | ---------------------------->|
    |                                |                             |
    |                                |  session.url                 |
    |  { checkoutUrl }               | <----------------------------
    | <------------------------------|                             |
    |                                |                             |
    |  Redirection navigateur vers checkoutUrl (page Stripe)      |
    | ==========================================================>  |
    |                                                              |
    |  Le client paie sur la page Stripe                            |
    |                                                              |
    |  Stripe envoie un webhook "checkout.session.completed"       |
    |  POST /api/v1/billing/stripe/webhook  <----------------------|
    |                                |                             |
    |                                |  Met à jour la BDD           |
    |                                |  (subscription active ou    |
    |                                |   ressource PENDING_VERIFICATION)
```

---

## 1. Côté frontend (ce que voit l’utilisateur)

### Parcours Ressource (`/onboarding/resource`)

1. L’utilisateur remplit le formulaire et clique sur **« Créer mon compte RESOURCE »**.
2. L’API crée le compte (auth) et le profil ressource ; le frontend reçoit un token et l’enregistre.
3. L’utilisateur clique sur **« Payer les frais d'inscription »**.
4. Le frontend appelle **`POST /api/v1/billing/resource/checkout-session`** avec le token (Bearer).
5. L’API répond avec **`checkoutUrl`** (URL de la page de paiement Stripe).
6. Le frontend fait **`window.location.href = checkoutUrl`** → l’utilisateur est redirigé vers **Stripe Checkout**.
7. Sur Stripe, il paie (carte de test en démo).
8. Stripe le redirige vers **success_url** ou **cancel_url** (configurés dans ton backend, ex. `APP_FRONTEND_URL/billing/success?type=resource`).

### Parcours Famille (`/onboarding/family`)

Même idée, mais pour l’abonnement :

1. Création du compte FAMILY.
2. Clic sur **« Activer abonnement FAMILY »**.
3. Appel à **`POST /api/v1/billing/family/checkout-session`** → récupération de **`checkoutUrl`**.
4. Redirection vers Stripe Checkout (mode **subscription** au lieu d’un paiement unique).
5. Après paiement, Stripe redirige vers success/cancel.

---

## 2. Côté backend (ton API)

### Variables d’environnement (`.env`)

| Variable | Rôle |
|--------|------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (ex. `sk_test_...`) pour créer des sessions et vérifier les webhooks. |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe pour vérifier que les événements viennent bien de Stripe. |
| `STRIPE_RESOURCE_ONBOARDING_PRICE_ID` | ID du **prix** Stripe pour le paiement unique ressource (ex. `price_xxx`). |
| `STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID` | ID du **prix** Stripe pour l’abonnement famille (ex. `price_yyy`). |
| `APP_FRONTEND_URL` | URL du frontend ; utilisée pour `success_url` et `cancel_url` (ex. `http://localhost:3002`). |

### Endpoints utilisés par le frontend

- **`POST /api/v1/billing/resource/checkout-session`** (auth JWT, rôle RESOURCE)  
  → Crée une **Checkout Session** Stripe en mode **payment** (paiement unique), avec `metadata: { userId, kind: "RESOURCE_ONBOARDING" }`.  
  → Met le profil ressource en **PENDING_PAYMENT**.  
  → Retourne **`checkoutUrl`** et **`sessionId`**.

- **`POST /api/v1/billing/family/checkout-session`** (auth JWT, rôle FAMILY)  
  → Crée une **Checkout Session** en mode **subscription**.  
  → Même principe avec **`checkoutUrl`** et **`sessionId`**.

### Webhook Stripe

- **`POST /api/v1/billing/stripe/webhook`** (public, pas de JWT).  
  Stripe envoie ici l’événement **`checkout.session.completed`** après un paiement réussi.

Le backend :

1. Vérifie la signature avec **`STRIPE_WEBHOOK_SECRET`** (sauf en test / si secret manquant, où il peut accepter sans vérifier).
2. Selon **`metadata.kind`** :
   - **`RESOURCE_ONBOARDING`** : appelle **`markResourcePaymentCompleted(userId)`**  
     → passe le profil ressource en **PENDING_VERIFICATION**, **PENDING_VERIFICATION** en vérification, **HIDDEN** en publication.
   - **`FAMILY_SUBSCRIPTION`** : appelle **`markFamilySubscriptionActive(userId, customerId, subscriptionId)`**  
     → crée ou met à jour une **Subscription** en base (status ACTIVE, `stripeCustomerId`, `stripeSubscriptionId`).

C’est **le webhook** qui met vraiment à jour ta base après le paiement ; la redirection success/cancel sert surtout à ramener l’utilisateur sur ton site.

---

## 3. Comportement en démo (développement)

Si **`STRIPE_SECRET_KEY`** est vide ou contient `xxx` / `placeholder`, le backend **ne crée pas** de vraie session Stripe. Il renvoie une **URL de fallback** vers ton frontend (ex. `/onboarding?mockCheckout=1`) pour que tu puisses continuer à naviguer sans configurer Stripe.

En démo « sérieuse » (vrais paiements test) :

1. Tu crées un compte Stripe (mode test) : https://dashboard.stripe.com.
2. Tu récupères **Clé secrète** (test) → **`STRIPE_SECRET_KEY`**.
3. Tu crées deux **Produits / Prix** dans Stripe :
   - un pour le **paiement unique** ressource → **`STRIPE_RESOURCE_ONBOARDING_PRICE_ID`** ;
   - un pour l’**abonnement** famille → **`STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID`**.
4. Tu configures un **Webhook** dans Stripe qui envoie **`checkout.session.completed`** vers :  
   `https://ton-api-public/api/v1/billing/stripe/webhook`  
   (en local, tu peux utiliser **ngrok** pour exposer ton API et mettre l’URL ngrok dans Stripe).
5. Tu copies le **Signing secret** du webhook → **`STRIPE_WEBHOOK_SECRET`**.

Résumé : **en démo sans vraie clé Stripe**, le bouton « Payer » redirige vers une URL mock ; **avec des clés test Stripe**, le flux est le même qu’en prod (paiement test + webhook qui met à jour la BDD).

---

## 4. Pages success / cancel

Actuellement, le backend renvoie vers **`APP_FRONTEND_URL/billing/success?type=resource`** (ou `type=family`) et **`.../billing/cancel?type=...`**. Il n’y a pas encore de routes **`/billing/success`** et **`/billing/cancel`** dans le frontend : tu peux les ajouter pour afficher un message du type « Paiement reçu » ou « Paiement annulé » après le retour depuis Stripe.

---

## 5. Résumé en une phrase

Le frontend demande une **URL de paiement** à ton API ; l’API crée une **Checkout Session** Stripe et renvoie cette URL ; l’utilisateur paie sur Stripe ; Stripe envoie un **webhook** à ton API ; l’API met à jour la base (ressource en attente de vérification, ou abonnement famille actif).
