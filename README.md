# Sans prix

Extension Firefox qui **masque les prix sur les grandes boutiques en ligne** —
Amazon, Fnac, Cdiscount, Darty, Boulanger, LDLC, E.Leclerc, Carrefour, Auchan,
eBay, AliExpress, Zalando… — et sur **Google** (produits sponsorisés de la
recherche et de Google Images), pour laisser un enfant parcourir des idées de
cadeaux sans lui donner la notion de prix.

## Pourquoi

À l'approche de Noël ou d'un anniversaire, le plus sûr moyen de savoir ce qui
ferait plaisir à un enfant, c'est de le laisser parcourir les boutiques en
ligne et de le regarder faire : ce qu'il ouvre, ce sur quoi il s'attarde, ce
qu'il montre du doigt. Mais les prix sont partout, et ils changent la
conversation :

- l'enfant **se censure** (« celui-là, c'est trop cher ») ou, à l'inverse, vise
  le plus cher en le croyant le meilleur ;
- il **compare** : « mon frère a eu un cadeau à 80 €, moi à 30 € » ;
- le **budget**, qui est l'affaire des parents, devient un sujet de discussion.

Sans les prix, il choisit sur ce que l'objet est — photos, description, avis —
et la question du montant reste entre adultes. Une fois l'enfant parti,
<kbd>Alt</kbd>+<kbd>Maj</kbd>+<kbd>P</kbd> fait revenir les prix pour faire les
comptes.

Le masquage s'applique **avant** que la page ne s'affiche : aucun prix ne
clignote au chargement, pas même une fraction de seconde. Seules les remises en
pourcentage (« -50 % ») restent visibles — voir
[Ce qui est masqué](#ce-qui-est-masqué).

Le même principe sert à qui veut comparer des produits sans se laisser guider
par leur prix.

## En pratique

Les prix sont remplacés par une **barre grise** (ou **floutés**, au choix). Un
interrupteur dans le popup, ou <kbd>Alt</kbd>+<kbd>Maj</kbd>+<kbd>P</kbd>, les
fait revenir dans tous les onglets à la fois ; une pastille « off » sur l'icône
rappelle qu'ils sont visibles.

<img src="docs/popup.png" alt="Le popup : interrupteur « Masquer les prix », choix entre barre grise et flou, liste des sites couverts" width="290">

_Extension indépendante : ni éditée ni approuvée par les sites qu'elle couvre._

## Installer

Firefox 140 ou plus récent.

| Façon                              | Durée                  | Ce qu'il faut                                                                                                                                                                      |
| ---------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Temporaire**                     | jusqu'au redémarrage   | `about:debugging#/runtime/this-firefox` → _Charger un module complémentaire temporaire…_ → choisir `extension/manifest.json`                                                       |
| **Essai en un geste**              | le temps de la session | `npm install` puis `npm start` : ouvre Firefox sur amazon.fr, extension chargée, rechargée à chaque modification                                                                  |
| **Permanente, pour soi**           | définitive             | signer sans publier : clés d'API sur [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/), puis `npx web-ext sign --channel unlisted --source-dir extension` |
| **Permanente, pour tout le monde** | définitive             | publier sur addons.mozilla.org (`--channel listed`), après relecture par Mozilla                                                                                                  |

Firefox refuse d'installer durablement une extension non signée, sauf dans
Developer Edition ou Nightly avec `xpinstall.signatures.required` à `false`.

## Ce qui est masqué

| Site                | Domaines couverts                     | Vérifié sur le vrai site                                        |
| ------------------- | ------------------------------------- | --------------------------------------------------------------- |
| **Amazon**          | 23 boutiques                          | ✔ amazon.fr, .com, .co.uk, .de, .es, .it                        |
| **AliExpress**      | aliexpress.com                        | ✔                                                               |
| **Auchan**          | auchan.fr                             | ✔                                                               |
| **Boulanger**       | boulanger.com                         | ✔                                                               |
| **Cdiscount**       | cdiscount.com                         | ✔                                                               |
| **Dealabs**         | dealabs.com                           | ✔                                                               |
| **Decathlon**       | 11 pays                               | ✔ decathlon.fr                                                  |
| **E.Leclerc**       | e.leclerc, leclerc.fr                 | ✔                                                               |
| **eBay**            | ebay.fr, ebay.com                     | ✔ les deux                                                      |
| **LDLC**            | ldlc.com                              | ✔                                                               |
| **Rue du Commerce** | rueducommerce.fr                      | ✔                                                               |
| **Zalando**         | zalando.fr                            | ✔ (générique seul)                                              |
| **Fnac**            | fnac.com                              | ✘ anti-robot ; règle tirée de la liste, vue une fois             |
| **Darty**           | darty.com                             | ✘ anti-robot ; générique seul                                   |
| **Carrefour**       | carrefour.fr                          | ✘ anti-robot ; générique seul                                   |
| **ManoMano**        | manomano.fr                           | ✘ anti-robot ; générique seul                                   |
| **Rakuten**         | rakuten.com                           | — la place de marché française a fermé ; générique seul         |
| **Google**          | www.google.fr, .com, .be, .ch, … (9)  | ◐ recherche et Images, voir ci-dessous                          |

« ✔ » : `npm run verifier` a visité une liste et une fiche produit et n'y a
trouvé aucun montant lisible. Les autres domaines d'Amazon et de Decathlon
partagent le balisage du site vérifié, sans l'avoir été eux-mêmes.

« ◐ » Google : la recherche et Google Images répondent au Firefox piloté par
leur page anti-robot (`/sorry`). Les scripts de l'extension ont été rejoués sur
les vraies pages dans un autre navigateur (Chromium), réglages simulés : aucun
montant lisible, produits sponsorisés compris (« Avant : ▬ », « + ▬ de
frais »). C'est le même code, sur le même balisage ; ce n'est pas Firefox.

Sur Google, la règle porte sur des **hôtes exacts** (`www.google.fr`…) et non
sur le domaine : `*.google.com` ferait tourner l'extension dans Gmail, Docs ou
Drive. Elle masque les montants de **toute** la page de résultats, pas
seulement du bloc sponsorisé : fiches Shopping, extraits, aperçu IA (« moins
de ▬ »).

« ✘ anti-robot » : ces sites répondent à un navigateur piloté par une
vérification anti-robot, que le script ne contourne pas. Leur balisage n'a pas
pu être relevé ; l'extension y applique les mécanismes génériques ci-dessous,
qui ne dépendent d'aucun sélecteur, mais leur résultat n'a pas été vu. Les
vérifier demande de passer soi-même la vérification (`VISIBLE=1`).

Partout :

- les composants de prix du site, prix barrés compris (« Prix conseillé »,
  « Prix le plus bas sur 30 jours ») ;
- tout montant écrit en clair : « 3 neufs à partir de 12,99 € », « Livraison
  gratuite dès 35 € », « de 10 à 20 EUR », titres des bons plans Dealabs… ;
- les prix **éclatés** en morceaux (« 34 » « €99 ») ;
- le **titre de l'onglet** : « Robot X60 999€ chez Boulanger » devient « Robot
  X60 ••• chez Boulanger », et retrouve son prix quand on suspend le masquage.

Les montants sont reconnus en euros, dollars, livres, yens, roupies, zlotys,
couronnes, livres turques et codes ISO (`EUR 12,99`, `AED 49.00`).

**Restent visibles, volontairement** : les remises en pourcentage (« -50 % »),
les notes, les nombres d'avis et les stocks. On masque des montants, pas les
promotions ; et un nombre sans devise n'est jamais pris pour un prix.

## Comment ça marche

Un **moteur de règles** : chaque site est décrit par une règle de quelques
lignes ([`regles.js`](extension/regles.js)) ; tout le reste est générique.

```js
{
  id: "decathlon",
  nom: "Decathlon",
  domaines: ["decathlon.fr", "decathlon.be", /* … */],
  masquer: [".vp-price-amount", ".vp-price-barred-amount", /* … */],
}
```

Sur une page, [`masquage.js`](extension/content/masquage.js) applique quatre
mécanismes :

1. **La feuille du site.** Le moteur ([`moteur.js`](extension/content/moteur.js))
   tire des sélecteurs `masquer` une feuille de style, posée dès
   `document_start` : les composants de prix connus sont couverts avant le
   premier affichage. Elle **échoue fermée** : le masquage vaut tant que la page
   ne porte pas `data-sans-prix="off"`, que le script ne pose qu'après avoir lu
   les réglages.
2. **Les montants dans le texte** ([`detection.js`](extension/content/detection.js)),
   recouverts par l'[API CSS Custom
   Highlight](https://developer.mozilla.org/fr/docs/Web/API/CSS_Custom_Highlight_API) :
   aucune balise ajoutée, aucun nœud découpé. Ces sites rendent leurs pages
   avec React ou Vue, qui gardent la main sur leurs nœuds texte — les envelopper
   dans un `<span>` casserait leurs mises à jour.
3. **Les prix éclatés.** Un nœud qui n'est qu'un morceau (« 34 », « €99 »)
   fait remonter à l'ancêtre proche (trois niveaux, 30 caractères au plus) qui
   forme un montant **et** apporte d'autres chiffres ; cet ancêtre reçoit un
   attribut que la feuille couvre. Comparer les chiffres plutôt que le texte
   laisse « Prix : 12,99 € » tranquille : le libellé n'ajoute aucun chiffre.
4. **Le titre de l'onglet**, dont les montants sont remplacés, puis rendus.

Un `MutationObserver` suit les carrousels, le défilement infini, les pages qui
se réhydratent — et repose les attributs de réglage sur `<html>` quand une
application les efface (Decathlon le fait).

### Ajouter un site

1. Écrire sa règle dans [`regles.js`](extension/regles.js) : des `domaines`
   (sous-domaines compris) ou des `hotes` exacts, quand le domaine entier
   serait trop large. `masquer` ne retient que des éléments qui ne contiennent
   **que** des prix ; le reste, le générique s'en charge. Un sélecteur invalide
   est ignoré sans emporter les autres.
2. Ajouter ses motifs aux `matches` du [manifeste](extension/manifest.json) —
   `npm test` refuse un écart entre les deux listes.
3. Ajouter une page de liste et un lien de fiche (ou des adresses fixes,
   `urls`) dans `PAGES` de
   [`scripts/verifier.mjs`](scripts/verifier.mjs), puis
   `SITES=<domaine> npm run verifier` jusqu'à n'avoir plus aucun montant
   lisible.

## Confidentialité

L'extension ne collecte, n'envoie ni ne lit rien d'autre que les pages des sites
qu'elle masque. Aucune requête réseau. Elle conserve deux réglages
(`actif`, `style`) dans `storage.sync`, qui suivent le compte Firefox s'il est
synchronisé. Le manifeste le déclare (`data_collection_permissions: none`).

## Limites connues

- Un prix dessiné dans une **image** (bannière, vignette d'un bon plan) reste
  visible.
- Une publicité servie dans un cadre d'un **autre domaine**
  (`amazon-adsystem.com`…) n'est pas couverte : l'extension ne demande l'accès
  qu'aux sites de ses règles.
- Ces sites changent leur balisage sans prévenir. Un nouveau composant de prix
  que ni la règle ni le générique ne reconnaissent passera — c'est ce que
  `npm run verifier` détecte.
- Un nombre **sans devise** n'est jamais pris pour un prix : les bornes d'un
  curseur de filtre « Prix (en €) : 4 – 1549 » (LDLC) restent lisibles.
- Quatre sites (Fnac, Darty, Carrefour, ManoMano) n'ont pas pu être vérifiés,
  et Google seulement hors de Firefox : voir le tableau ci-dessus.
- La feuille d'un site est posée dans un `<style>` ; une politique de sécurité
  (CSP) qui interdirait les styles en ligne la bloquerait. Aucun des sites
  vérifiés ne le fait ; le repérage dans le texte, lui, n'en dépend pas.

## Développer

```bash
npm install
```

```bash
npm test          # repérage des montants, moteur, règles, accord manifeste-règles
```

```bash
npm run lint      # validation du manifeste par web-ext (outil de Mozilla)
```

```bash
npm run verifier  # les vrais sites, dans le Firefox du poste
```

```bash
npm run build     # paquet .zip dans web-ext-artifacts/
```

La CI ([`ci.yml`](.github/workflows/ci.yml)) joue les tests, `web-ext lint`
(qui y échoue sur un avertissement) et l'empaquetage, sur chaque PR et sur
`main` ; une seconde garde refuse les signatures d'assistant dans les commits et
les fichiers. Les deux sont exigées pour fusionner. `npm run verifier`, qui
dépend des vrais sites, se lance à la main.

`npm run verifier` lance Firefox sur un profil jetable, extension installée, et
visite pour chaque site une liste puis une fiche produit. Il **relève chaque
montant encore lisible** — ni sous une barre, ni flouté, ni hors écran, titre de
l'onglet compris —, refuse au passage les bandeaux de cookies, puis bascule
l'interrupteur et l'apparence depuis le popup et vérifie que la page suit.
Captures dans `captures/`. Variables : `SITES` (`amazon.fr,cdiscount.com`…),
`FIREFOX` (chemin de l'exécutable), `VISIBLE=1` pour voir la fenêtre.

Pour ouvrir le popup, le script passe par la fenêtre de Firefox elle-même
(`MOZ_REMOTE_ALLOW_SYSTEM_ACCESS`, sur le seul profil jetable) : WebDriver BiDi
refuse de naviguer vers une adresse `moz-extension://`. Un site qui répond par
une vérification anti-robot est noté « non vérifié », sans contournement ;
`VISIBLE=1` permet de la passer soi-même.

```
extension/
├── manifest.json          MV3, Firefox 140+
├── regles.js              une règle par site : domaines, sélecteurs
├── background.js          raccourci clavier, pastille « off » sur l'icône
├── commun/reglages.js     réglages partagés (storage.sync)
├── content/
│   ├── moteur.js          choisir la règle, en tirer la feuille (fonctions pures)
│   ├── detection.js       repérage des montants dans un texte
│   ├── masquage.js        feuille, surlignage, prix éclatés, titre, réglages
│   └── masquage.css       peinture des montants surlignés
├── popup/                 interrupteur, apparence, sites couverts
├── icons/icone.svg
└── _locales/              fr (par défaut), en
```

## Licence

[MIT](LICENSE)
