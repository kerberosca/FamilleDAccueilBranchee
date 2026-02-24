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

### Phase 3 — Page « Devenir allié »
- [ ] 3.1 Hero : titre validé
- [ ] 3.2 Conserver « Trois types d'alliés » et les 3 cartes
- [ ] 3.3 Remplacer « Comment ça marche ? » par le titre validé (4 étapes)
- [ ] 3.4 CTA final : titre + bouton validés

### Phase 4 — Preuve sociale (optionnel)
- [ ] 4.1 Afficher un chiffre si disponible (ex. X alliés, Y régions)
- [ ] 4.2 Court message « Alliés vérifiés » près de la recherche

### Phase 5 — Polish
- [ ] 5.1 Cohérence des phrases sur tout le site
- [ ] 5.2 Accessibilité (contrastes, libellés, titres)
- [ ] 5.3 Micro-interactions (survol, focus)

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
