# Suivi des changements UX — FAB

Document de suivi pour la refonte des messages et de la structure des pages (accueil, Devenir allié), en conservant les couleurs et en se démarquant des concurrents.

**Dernière mise à jour** : 23 février 2025.  
**Phase 1** : appliquée le 23 février 2025.

---

## 1. Choix des phrases (validés ou à valider)

### Hero page d'accueil — ✅ Validé
- **Phrase retenue :** « **Là où les familles d'accueil trouvent leur soutien.** »
- À intégrer en titre principal (le mot **FAB** reste en dégradé cyan si souhaité, ex. en sous-titre ou accolé).

### Sous-titre / recherche (accueil) — ✅ Appliqué
- [x] « Un code postal, des alliés. C'est parti. »
- [ ] « Entrez votre code postal et découvrez les alliés à proximité. »
- [ ] « Trouvez des alliés vérifiés par code postal. »
- **Choix :** Un code postal, des alliés. C'est parti.

### Bandeau « Devenir allié » (accueil) — ✅ Appliqué
- [ ] « Donnez du répit aux familles. Devenez allié. »
- [x] « Votre temps, leurs besoins. Rejoignez FAB comme allié. »
- [ ] « Les familles d'accueil ont besoin de soutien. Vous pouvez en être. »
- **Choix :** Votre temps, leurs besoins. Rejoignez FAB comme allié.

### CTA principal (bouton / lien) — ✅ Appliqué
- [ ] « Devenir allié »
- [ ] « Créer mon profil allié »
- [x] « Rejoindre le répertoire FAB »
- **Choix :** Rejoindre le répertoire FAB (sous le bandeau)

### Page « Devenir allié » — Titre hero — ✅ Conservé
- [x] Garder « Qu'est-ce qu'un allié ? »
- [ ] « Soutenez les familles d'accueil. Devenez allié. »
- **Choix :** Qu'est-ce qu'un allié ?

### Section « Comment ça marche » — ✅ Appliqué
- [ ] « Votre parcours en 4 étapes »
- [x] « Du profil à la mise en relation : quatre étapes. »
- **Choix :** Du profil à la mise en relation : quatre étapes.

### CTA final page Devenir allié — ✅ Appliqué
- [ ] « Prêt à soutenir des familles d'accueil ? Créez votre profil allié. »
- [x] « Rejoignez le répertoire : créer mon compte allié. »
- **Choix :** Rejoignez le répertoire : créer mon compte allié. (titre du bloc CTA)

---

## 2. Plan par phase — suivi

### Phase 1 — Messages & accroches ✅
- [x] Valider la phrase hero (Là où les familles d'accueil trouvent leur soutien.)
- [x] Valider sous-titre recherche (Un code postal, des alliés. C'est parti.)
- [x] Valider bandeau allié (Votre temps, leurs besoins. Rejoignez FAB comme allié.)
- [x] Valider CTA principal (Rejoindre le répertoire FAB)
- [x] Valider titres et CTA page Devenir allié (Comment ça marche → Du profil à la mise en relation ; CTA Rejoignez le répertoire : créer mon compte allié.)

### Phase 2 — Page d'accueil ✅
- [x] 2.1 Remplacer le titre hero par la phrase validée
- [x] 2.2 Adapter le sous-titre (recherche)
- [x] 2.3 Conserver / ajuster le bloc recherche (code postal + tags)
- [x] 2.4 Mettre à jour le bandeau allié (phrase + CTA)
- [x] 2.5 Ajouter les 3 cartes catégories (Ménage, Gardiens, Autres) sous la recherche — liens vers recherche avec tag (ménage, garde, transport)

### Phase 3 — Page « Devenir allié » ✅
- [x] 3.1 Hero : titre validé (« Qu'est-ce qu'un allié ? »)
- [x] 3.2 Conserver « Trois types d'alliés » et les 3 cartes
- [x] 3.3 Remplacer « Comment ça marche ? » par « Du profil à la mise en relation : quatre étapes. »
- [x] 3.4 CTA final : « Rejoignez le répertoire : créer mon compte allié. » + bouton « Créer mon compte allié »

### Phase 4 — Preuve sociale ✅
- [ ] 4.1 Afficher un chiffre si disponible (ex. X alliés, Y régions) — _optionnel, nécessiterait un endpoint stats côté backend_
- [x] 4.2 Court message « Alliés vérifiés (vérification d'antécédents). » sous le formulaire de recherche
- [x] Mention Forméduc : « FAB est une initiative de Forméduc, reconnu pour la formation en secourisme au Québec. » avec lien vers formeduc.ca (sous les cartes, avant le bandeau)

### Phase 5 — Polish ✅
- [x] 5.1 Cohérence : meta description (layout) alignée sur le hero — « Là où les familles d'accueil trouvent leur soutien. Trouvez des alliés… Une initiative Forméduc. »
- [x] 5.2 Accessibilité : aria-label sur le formulaire de recherche, aria-label lien Forméduc (nouvelle fenêtre), focus-visible:ring-offset sur liens, aria-label bandeau « Rejoindre le répertoire »
- [x] 5.3 Micro-interactions : transition duration-200 sur cartes, bandeau et liens (accueil + page Devenir allié)

---

## 3. Fichiers impactés (à mettre à jour)

| Fichier | Modifications prévues |
|---------|------------------------|
| `frontend/app/page.tsx` | Hero, sous-titre, bandeau, cartes catégories |
| `frontend/app/devenir-allie/page.tsx` | Titres, « Comment ça marche », CTA final |
| `frontend/app/layout.tsx` | Meta description si besoin |
| Autres (onboarding, emails) | Phase 5.1 |

---

## 4. Notes

- **Couleurs** : conserver fond sombre (#0a0e17), accent cyan, slate. Aucun changement de charte.
- **Référence** : voir la synthèse des exemples concurrents et le plan détaillé (échange du 23 fév.) pour le contexte des choix.
