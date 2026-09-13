# Validation Stripe des abonnements famille

La facturation FAB est fermée par défaut. Aucun paiement ne peut être ouvert avec
`STRIPE_BILLING_MODE=DISABLED` ou `STRIPE_CHECKOUT_ENABLED=false`.

## Préparer la sandbox locale

Créer dans Stripe un prix récurrent mensuel en dollars canadiens, sans période
d'essai, puis configurer localement les variables suivantes. Les valeurs secrètes
restent dans `.env` et ne doivent jamais être ajoutées à Git.

```env
STRIPE_BILLING_MODE=TEST
STRIPE_CHECKOUT_ENABLED=true
STRIPE_TAX_MODE=AUTOMATIC
STRIPE_SECRET_KEY=sk_test_...
STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Si Stripe Tax n'est pas configuré dans la sandbox, utiliser temporairement
`STRIPE_TAX_MODE=DISABLED`. En production, `UNCONFIRMED` bloque toujours le
Checkout réel.

Le démarrage de l'API vérifie que la clé et le prix appartiennent au mode test,
et que le prix est actif, mensuel et en CAD. Une incohérence empêche le démarrage.

## Acheminer les webhooks locaux

Après connexion avec Stripe CLI :

```bash
stripe listen --forward-to http://localhost:3000/api/v1/billing/stripe/webhook
```

Copier le secret `whsec_...` affiché par Stripe CLI dans `.env`, puis redémarrer
l'API. Le endpoint exige le corps HTTP brut et une signature valide.

## Autoriser un seul compte

1. Créer ou choisir une famille réservée aux essais.
2. Dans l'administration FAB, afficher les familles puis choisir « Marquer comme
   test interne ».
3. Confirmer que les autres familles restent opérationnelles et non marquées.
4. Ouvrir « Mon profil » avec la famille test et lancer Stripe Checkout.

En mode `TEST`, seule une famille marquée « Test interne » peut payer. En mode
`LIVE`, ces mêmes familles sont systématiquement bloquées.

## Scénarios à vérifier dans Stripe

- paiement accepté et activation après le webhook;
- abandon ou expiration du Checkout sans activation;
- carte refusée sans accès premium;
- authentification 3D Secure;
- consultation des factures et modification de la carte dans le portail;
- annulation en fin de période avec accès conservé jusqu'à cette date;
- premier renouvellement échoué : passage immédiat en retard et blocage premium;
- facture régularisée : réactivation après `invoice.paid`;
- événements rejoués ou reçus dans le désordre sans double effet;
- simulations de renouvellement avec une horloge de test Stripe.

Les numéros de carte et scénarios maintenus par Stripe sont disponibles dans la
[documentation de test](https://docs.stripe.com/testing). Les horloges de test sont
décrites dans la [documentation Billing](https://docs.stripe.com/billing/testing/test-clocks).

## Passage ultérieur en production

1. Le client confirme le produit, le prix, le portail client, les courriels Stripe,
   la fiscalité et le webhook live.
2. Placer les clés `sk_live_...`, `price_...` et `whsec_...` directement dans le
   `.env` du VPS.
3. Démarrer avec `STRIPE_BILLING_MODE=LIVE` et
   `STRIPE_CHECKOUT_ENABLED=false`.
4. Vérifier le démarrage et la configuration, puis ouvrir les nouveaux paiements
   avec `STRIPE_CHECKOUT_ENABLED=true`.
5. Surveiller la première souscription réelle et sa réception webhook.

L'arrêt d'urgence remet seulement `STRIPE_CHECKOUT_ENABLED=false`. Les webhooks,
le portail et les abonnements déjà payés continuent alors de fonctionner.
