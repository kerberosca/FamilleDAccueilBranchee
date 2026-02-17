# Créer une clé SSH (Windows)

## 1. Ouvrir PowerShell

Ouvre **PowerShell** (clic droit sur Démarrer → Windows PowerShell, ou `Win + X` → Terminal).

---

## 2. Générer la clé

Colle cette commande (tu peux garder l’adresse e-mail ou la remplacer par la tienne) :

```powershell
ssh-keygen -t ed25519 -C "ton-email@exemple.com" -f "$env:USERPROFILE\.ssh\id_ed25519_fab"
```

- **`-t ed25519`** : type de clé moderne et sûr.
- **`-C "..."`** : commentaire (souvent ton e-mail), pour repérer la clé.
- **`-f ...`** : chemin du fichier. Ici la clé sera nommée `id_ed25519_fab` pour ne pas écraser une clé existante.

Quand tu exécutes la commande :

1. **Passphrase** : on te demande une phrase secrète. Tu peux :
   - en mettre une (recommandé) : tu la retapes à chaque connexion,
   - ou appuyer sur **Entrée** deux fois pour ne pas en mettre (plus simple pour une démo).
2. La clé est créée dans `C:\Users\TonNom\.ssh\` :
   - **`id_ed25519_fab`** = clé **privée** (ne jamais la partager),
   - **`id_ed25519_fab.pub`** = clé **publique** (c’est celle qu’on ajoute sur le VPS).

---

## 3. Afficher la clé publique (à copier dans le VPS)

Pour afficher le contenu de la clé **publique** et le copier :

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_fab.pub"
```

Tu verras une ligne du type :

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... ton-email@exemple.com
```

**Copie toute cette ligne** (Ctrl+C après sélection). C’est ce que tu colleras dans l’interface du VPS (SSH Keys → Add Key → colle dans le champ « Key »).

---

## 4. Ajouter la clé sur ton hébergeur VPS

Dans la page de déploiement du serveur (là où tu as « SSH Keys » → « Select... ») :

1. Clique sur **Select...** ou **Add SSH Key**.
2. Donne un **nom** à la clé (ex. « Mon PC » ou « Cursor »).
3. Colle **toute la ligne** de la clé publique dans le champ prévu.
4. Enregistre / ajoute la clé, puis **sélectionne-la** pour ce déploiement.

Comme ça, au premier démarrage, le VPS aura déjà ta clé et tu pourras te connecter en SSH sans mot de passe (ou en ne tapant que la passphrase de la clé si tu en as mis une).

---

## 5. Se connecter au VPS avec cette clé

Une fois le serveur créé, tu te connectes avec :

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_fab" root@IP_DU_SERVEUR
```

Remplace **`IP_DU_SERVEUR`** par l’adresse IP affichée dans le dashboard (ex. `123.45.67.89`).  
Si ton hébergeur utilise un utilisateur autre que `root` (ex. `ubuntu`), remplace `root` par ce nom.

---

## Résumé

| Étape | Action |
|-------|--------|
| 1 | `ssh-keygen -t ed25519 -C "ton@email.com" -f "$env:USERPROFILE\.ssh\id_ed25519_fab"` |
| 2 | Passphrase au choix (ou Entrée deux fois) |
| 3 | `Get-Content "$env:USERPROFILE\.ssh\id_ed25519_fab.pub"` → copier la ligne |
| 4 | Coller cette ligne dans l’interface VPS (SSH Keys) et sélectionner la clé |
| 5 | Déployer le serveur, puis `ssh -i ...\id_ed25519_fab root@IP` |
