# Installer « Sans prix » {{version}}

Extension Firefox qui masque les prix pendant qu'on fait défiler une boutique
avec un enfant : il choisit ce qui lui plaît, sans savoir ce que ça coûte.
Firefox 140 ou plus récent, sur ordinateur.

| Fichier du paquet                 | À quoi il sert                                                       |
| --------------------------------- | -------------------------------------------------------------------- |
| `mister-no-price-{{version}}.xpi` | l'extension **signée par Mozilla** : installation durable (§ 1, § 3) |
| `mister-no-price-{{version}}.zip` | l'extension non signée : essai, ou Firefox Developer Edition (§ 2)   |
| `policies.json`                   | imposer l'extension sur un ordinateur familial (§ 3)                 |
| `SHA256SUMS`                      | vérifier que les fichiers n'ont pas été altérés (§ 4)                |

Le `.xpi` n'existe que si le paquet a été signé. S'il manque, passer au § 2.

## 1. Installer le fichier signé (recommandé)

1. Dans Firefox, ouvrir le menu **≡ → Extensions et thèmes** (ou taper
   `about:addons` dans la barre d'adresse).
2. Cliquer sur la **roue dentée** → **Installer un module depuis un fichier…**
3. Choisir `mister-no-price-{{version}}.xpi`, puis **Ajouter**.
4. **Navigation privée** : Firefox n'y lance pas les extensions par défaut. Un
   enfant qui ouvre une fenêtre privée reverrait les prix. Dans
   `about:addons` → **Sans prix** → **Exécuter dans les fenêtres privées** :
   **Autoriser**.

L'icône apparaît dans la barre d'outils (sinon : pièce de puzzle → épingler).
Un clic ouvre le réglage : interrupteur, barre ou flou, sites couverts.

**Mettre à jour** : installer le `.xpi` de la nouvelle version par-dessus,
de la même façon. Les réglages sont conservés.

## 2. Installer le fichier non signé (.zip)

- **Pour essayer, jusqu'au prochain redémarrage de Firefox** :
  `about:debugging#/runtime/this-firefox` → **Charger un module complémentaire
  temporaire…** → choisir `mister-no-price-{{version}}.zip`.
- **Durablement**, seulement dans Firefox **Developer Edition**, **Nightly** ou
  **ESR** : `about:config` → `xpinstall.signatures.required` → `false`, puis
  installer le `.zip` comme au § 1. Le Firefox ordinaire refuse toute extension
  non signée, quel que soit ce réglage.

## 3. Sur un ordinateur familial : imposer l'extension

Une stratégie d'entreprise Firefox installe l'extension pour toutes les
sessions de l'ordinateur et empêche de la **retirer** ou de la **désactiver**
depuis `about:addons`. Elle exige le `.xpi` signé.

1. Copier `mister-no-price-{{version}}.xpi` dans un dossier stable et le
   renommer **sans numéro de version** : `C:\Firefox\mister-no-price.xpi`.
2. Ouvrir `policies.json`, corriger le chemin de `install_url` s'il diffère
   (barres obliques `/`, trois après `file:`).
3. Copier `policies.json` dans le dossier `distribution` de Firefox (le créer
   s'il n'existe pas) — droits d'administrateur requis :

   | Système | Dossier                                                      |
   | ------- | ------------------------------------------------------------ |
   | Windows | `C:\Program Files\Mozilla Firefox\distribution\`             |
   | macOS   | `/Applications/Firefox.app/Contents/Resources/distribution/` |
   | Linux   | `/etc/firefox/policies/`                                     |

4. Redémarrer Firefox. `about:policies` doit afficher **Active** et la
   stratégie `ExtensionSettings`.

La stratégie autorise aussi l'extension en navigation privée
(`private_browsing`). Elle ne verrouille pas l'interrupteur du popup ni le
raccourci **Alt+Maj+P** : qui connaît le geste peut suspendre le masquage.

**Mettre à jour** : écraser `C:\Firefox\mister-no-price.xpi` par le fichier
de la nouvelle version, puis redémarrer Firefox. Il réinstalle l'extension dès
que le fichier change à ce chemin ; `policies.json` ne bouge pas.

Firefox 136 ou ESR 128.8 au moins pour `private_browsing` ; plus ancien, la
clé est ignorée et le § 1, étape 4, reste à faire à la main.

## 4. Vérifier l'intégrité des fichiers

Comparer l'empreinte calculée à celle de `SHA256SUMS` :

```powershell
Get-FileHash mister-no-price-{{version}}.xpi -Algorithm SHA256
```

```bash
sha256sum -c SHA256SUMS
```

## Après une mise à jour : un « ! » sur l'icône

Une version qui ajoute des sites ne reçoit pas d'office leur accès. Ouvrir le
popup et cliquer sur **Autoriser** : les prix restent masqués d'une page à
l'autre.

---

Identifiant de l'extension : `{{id}}` · Code source et limites connues :
<https://github.com/mister-guiiug/mister-no-price>
