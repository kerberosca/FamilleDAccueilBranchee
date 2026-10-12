# Infolettre FAB — formulaire natif et Cyberimpact

Les pages `/infolettre` et `/infolettre/congres` affichent un formulaire FAB avec prénom et courriel. Le serveur FAB ajoute le contact directement via l’API Cyberimpact : aucun appel à `optin` et aucun envoi de courriel par FAB. Le scénario Cyberimpact 45 envoie le seul bienvenue FAB.

Cyberimpact reste la liste de référence pour les abonnements et les désabonnements. La table FAB `NewsletterConsent` est uniquement un journal de consentement et de transmission; elle ne sert pas à envoyer des infolettres.

## Configuration du compte

- Groupe `Lancement FAB` : id **57**. Groupe `Congrès FAB` : id **58**.
- Scénario actif : `Bienvenue — Lancement FAB v2` (id **45**), déclenché par l’ajout au groupe 57 et limité à **un passage par contact**. Le scénario 44 demeure en pause. Ne pas créer un second scénario pour le congrès.
- Expéditeur et réponse : `Famille Branchée <info@familledaccueilbranchee.ca>`. Sujet : `Bienvenue chez FAB — le lancement approche`. Salut `Bonjour,` compatible avec un prénom absent. Logo sur fond violet, textes et couleurs FAB, lien de désabonnement.
- Le pied de page commun affiche **Forméduc**, 5121 boul. Chauveau Ouest, local 101, Québec G2E 5A6, 418 842-7523, et `info@familledaccueilbranchee.ca`. Ce réglage touche les autres campagnes du compte.
- Le domaine FAB et l’adresse d’expéditeur ont été validés le 12 octobre 2026. Cyberimpact indiquait DKIM et DMARC valides. Le vrai bienvenue envoyé à 9 h 17 est arrivé dans la boîte de réception. Un essai effectué avec « Tester mon envoi » utilisait l’expéditeur par défaut du compte et avait été classé comme indésirable; ce bouton ne reproduit pas le scénario FAB.
- Les anciens formulaires Cyberimpact existent toujours dans le compte mais ne sont plus intégrés au site. Ne pas diffuser leurs URL : ils envoient une confirmation Forméduc supplémentaire. Le QR vise la page FAB stable `https://familledaccueilbranchee.ca/infolettre/congres`.

## Parcours de l’inscription

1. `GET /api/v1/newsletter/form?source=site|congres` fournit le texte de consentement et un jeton signé valable 30 minutes, lié à la provenance, à l’IP et au navigateur. Il ne contient aucun secret Cyberimpact et ne doit pas être mis en cache.
2. Le bouton « Je m’inscris » accepte le texte affiché. `POST /api/v1/newsletter/subscribe` valide les champs, le consentement, le jeton, le délai minimal et le champ piège invisible.
3. FAB enregistre la preuve avant toute transmission : date serveur, prénom, courriel, provenance, version et texte du consentement, IP et navigateur. Le jeton ne peut servir qu’à une demande. Les états `PENDING`, `SYNCED` et `FAILED` distinguent les transmissions abouties des échecs.
4. FAB vérifie `GET /members/unsubscribed/{email}`. Une adresse désabonnée reste désabonnée; le formulaire invite à contacter FAB pour organiser une réinscription confirmée.
5. Un nouveau contact est créé par `POST /members`, en français (`fr_ca`), dans le groupe 57 et aussi 58 pour le congrès. La note du nouveau contact fait référence à la preuve FAB.
6. Pour un contact existant, FAB lit ses groupes et ajoute seulement ceux qui manquent via `POST /members/{key}/groups`. Son prénom et ses autres groupes sont conservés. Une répétition n’ajoute pas de nouveau contact ni de groupe déjà présent.
7. FAB annonce une réussite uniquement après la réponse positive de Cyberimpact et la mise à jour du journal. En cas d’échec ou de délai dépassé, les coordonnées restent dans le formulaire pour réessayer. Si Cyberimpact avait déjà reçu la demande, l’essai suivant relit le contact et ses groupes.

Le bienvenue est déclenché par Cyberimpact après l’ajout au groupe 57, avec son délai de traitement. Un contact ayant déjà traversé le scénario ne reçoit pas un nouveau bienvenue en répétant son inscription.

## Consentement et protection

Le choix d’un seul courriel utilise l’ajout direct. Cyberimpact ne recueille pas lui-même la preuve de consentement avec cet endpoint; son exemple documenté crée un contact avec `consentType: implied`. FAB conserve donc la preuve du texte accepté dans son journal. Le formulaire ne valide pas la propriété de l’adresse courriel. Ne pas présenter cette méthode comme un double opt-in ni comme une preuve recueillie par Cyberimpact. Pour qualifier le consentement comme exprès dans Cyberimpact, utiliser sa procédure de classement/importation avec la preuve FAB après validation du traitement par le fournisseur; le code ne force pas ce statut.

Le formulaire est protégé par un champ piège, un délai minimal d’une seconde, un jeton signé à usage unique et une limite de 60 soumissions/minute/IP (120 chargements/minute/IP). Ces protections réduisent les abus, mais ne constituent pas un CAPTCHA. Pour une campagne à forte visibilité ou un pic au congrès, convenir avec Cyberimpact des limites de l’API et prévoir une protection supplémentaire si des abus apparaissent. Les appels unitaires Cyberimpact sont limités et un refus est affiché comme une erreur temporaire, sans faux succès.

Les jetons, réponses du fournisseur, courriels et preuves ne sont jamais écrits dans les logs applicatifs. Le journal n’a aucune route de lecture publique. Les demandes de suppression et l’accès aux preuves sont gérés par l’équipe autorisée de Forméduc. La politique de confidentialité indique la collecte des preuves et le transfert vers Cyberimpact.

## Variables serveur

```dotenv
NEWSLETTER_ENABLED=false
CYBERIMPACT_API_TOKEN=
CYBERIMPACT_LAUNCH_GROUP_ID=57
CYBERIMPACT_CONGRESS_GROUP_ID=58
NEWSLETTER_FORM_SECRET=
NEWSLETTER_TRUST_PROXY=false
```

Le jeton Cyberimpact et le secret aléatoire dédié (au moins 32 caractères) sont réservés au serveur. Aucun préfixe `NEXT_PUBLIC_`, aucune clé dans Git. L’absence de clé ou l’activation manquante ferme le formulaire avec une erreur temporaire. Supprimer les anciennes variables `CYBERIMPACT_SITE_FORM_URL` et `CYBERIMPACT_CONGRESS_FORM_URL` de la configuration lorsque l’intégration native est prête.

En production, `NEWSLETTER_TRUST_PROXY=true` n’est valable qu’avec Caddy et l’API exposée uniquement sur `127.0.0.1`. Caddy établit `X-Forwarded-For`; ce réglage permet d’appliquer la limite aux visiteurs, plutôt qu’au proxy commun. Garder `false` en local ou en cas d’accès direct à l’API.

## Tests locaux avant publication

Les tests automatisés utilisent des adresses fictives et un fournisseur simulé; ils n’envoient aucun courriel.

```powershell
npm run prisma:generate
npm run build
npm --prefix frontend run build
npm run test:e2e -- --runInBand newsletter.e2e-spec.ts
npm run test:ui -- newsletter-ui.spec.ts
```

Un PostgreSQL distinct de test peut être lancé sur ce poste :

```powershell
docker run --rm -d --name fab-newsletter-test-postgres -e POSTGRES_PASSWORD=fab_test_local -e POSTGRES_DB=fab_newsletter_test -p 127.0.0.1:5436:5432 postgres:16
$env:DATABASE_URL = 'postgresql://postgres:fab_test_local@127.0.0.1:5436/fab_newsletter_test?schema=public'
npx prisma migrate deploy
```

Le fichier ignoré `local-data/newsletter.env` contient la configuration locale de ce test, le jeton Cyberimpact et un secret aléatoire. Le lanceur refuse une base autre que `fab_newsletter_test` sur le port 5436 et une API autre que le port 3006. Les autres courriels applicatifs sont en mode journal uniquement. Les ajouts à Cyberimpact déclenchent toutefois le scénario réel : utiliser uniquement des adresses de test autorisées.

```powershell
powershell -File scripts/start-newsletter-local.ps1
```

Configurer le frontend local avec `NEXT_PUBLIC_API_URL=http://127.0.0.1:3006/api/v1`, puis démarrer `npm --prefix frontend run dev`. Tester les deux pages, les groupes, un seul bienvenue, un contact existant, la répétition et l’erreur de réinscription pour une adresse désabonnée. Ne pas désabonner de vrais contacts pour les essais. Vérifier aussi le lien de désabonnement et scanner le QR sur plusieurs téléphones avant impression.

Validation du 12 octobre 2026 : builds backend et frontend réussis, 16 tests serveur et 6 tests UI réussis, migration appliquée dans la base locale jetable. Un essai avec PostgreSQL réel et fournisseur simulé a confirmé que la preuve est durable avant transmission, que le statut final est SYNCED et qu’une répétition ne provoque pas de double ajout.

L’essai réel via l’API a été effectué depuis le site local le 12 octobre 2026 : nouvelle inscription sur la page du site vers 11 h 25, puis inscription de la même adresse sur la page du congrès vers 11 h 26. Cyberimpact confirme les groupes 57 et 58, le même contact et la conservation du prénom initial. Les deux preuves locales sont SYNCED. Le scénario 45 est actif et son total est passé de 2 à 3 contacts et de 2 à 3 envois, soit un seul nouveau bienvenue pour cet essai. Le message est reçu à 11 h 27 sur la boîte Hotmail de test, dans les indésirables. Un contact déjà abonné a aussi été soumis depuis la page du site avec succès. La santé et le CORS du serveur local sont valides. Aucun déploiement de production n’a été effectué pendant cette préparation.

Les en-têtes de ce message indiquent SPF=pass (Return-Path email.cyberimpact.com), DKIM=pass (domaine FAB), DMARC=pass et compauth=pass (reason=100). Microsoft lui attribue SCL=5 et le livre dans JunkEmail; BCL=0. L’IP d’envoi est 64.95.196.60, gérée par Cyberimpact. Ces résultats confirment l’authentification du message, mais ne donnent pas la cause exacte de son classement : la réputation, le contenu et les critères du destinataire nécessitent une analyse supplémentaire. Ne pas attribuer ce résultat à un échec DNS et ne pas considérer la réception en boîte principale comme validée pour Hotmail. Le diagnostic est à poursuivre avec Cyberimpact, sans transmettre les liens de désabonnement personnels contenus dans la source du message.

Une demande d’analyse a été envoyée à support@cyberimpact.com le 12 octobre 2026, avec l’accord du responsable FAB. Elle contient le compte, le scénario, l’expéditeur, l’IP d’envoi, les résultats d’authentification, les valeurs SCL/BCL et le Message-ID; aucun lien personnel de désabonnement n’a été transmis. Les recommandations du fournisseur restent attendues. Aucun déploiement de production n’a été effectué.

## Code QR du congrès

Les fichiers locaux `outputs/infolettre-fab/qr-congres-fab.png` (720 × 720 pixels) et `outputs/infolettre-fab/qr-congres-fab.svg` encodent l’adresse définitive `https://familledaccueilbranchee.ca/infolettre/congres`. Le QR utilise le violet FAB sur fond blanc, une marge de quatre modules et une correction d’erreur Q. La lecture de l’image originale et d’une version réduite à 300 pixels a confirmé l’adresse encodée; le résultat est consigné dans `outputs/infolettre-fab/verification-qr.json`.

Ce QR est préparé pour la future page publique. Avant de le diffuser ou de l’imprimer, mettre la page en ligne selon la procédure FAB, puis scanner le QR sur téléphone et vérifier une inscription réelle depuis cette page. La validation logicielle du QR ne confirme pas encore l’accessibilité de la page de production.

## Production ultérieure

Suivre `docs/DEPLOIEMENT_PROD.md` : sauvegarde GestionVPS validée avant construction et migration, `docker-compose.prod.yml`, puis contrôles de santé et de CORS. Activer et vérifier le scénario 45 avant de diffuser les pages ou le QR. Le déploiement reste à faire après la validation locale et réelle.

## Sources

- [API Cyberimpact : ajout direct, consentement et jetons](https://faq.cyberimpact.com/fr/articles/21/comment-utiliser-l-api-de-cyberimpact)
- [Documentation des endpoints](https://api.cyberimpact.com/docs)
- [Courriels de bienvenue](https://faq.cyberimpact.com/fr/articles/1339/courriels-de-bienvenue)

## Préparation de la mise en production du 12 octobre 2026

La publication part de `main` (e20dd34926f1a86345166e2630062204052fcf07), avec uniquement les changements de l’infolettre. La branche et les conteneurs de la démonstration restent indépendants. La sauvegarde GestionVPS `f03-pre-maintenance-20261012T170236Z` est terminée et vérifiée hors site; le garde signé FAB est PASS avant construction. Les builds locaux et les 99 tests serveur sont réussis. Le contrat du garde de sauvegarde est PASS. Les secrets, données et artefacts locaux sont exclus des contextes Docker; la CI vérifie que la migration de consentement est bien incluse dans l’image API.

Avant de démarrer la nouvelle version, conserver les images et la configuration précédentes pour le retour arrière, puis ajouter uniquement les variables d’infolettre dans le `.env` du VPS. Les réglages actuels de formation, courriels, abonnement et authentification doivent être conservés. Après publication, vérifier les deux formulaires, une répétition d’inscription autorisée, les preuves SYNCED, la santé, le CORS, les parcours existants et la démo publique. Le classement en indésirables sur une boîte Hotmail reste un point suivi auprès de Cyberimpact.
