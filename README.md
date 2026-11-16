# Sans prix pour Amazon

Extension Firefox qui **masque les prix sur Amazon**, pour laisser un enfant
parcourir des idées de cadeaux sans lui donner la notion de prix.

## Pourquoi

À l'approche de Noël ou d'un anniversaire, le plus sûr moyen de savoir ce qui
ferait plaisir à un enfant, c'est de le laisser parcourir Amazon et de le
regarder faire : ce qu'il ouvre, ce sur quoi il s'attarde, ce qu'il montre du
doigt. Mais les prix sont partout, et ils changent la conversation :

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

<img src="docs/popup.png" alt="Le popup : interrupteur « Masquer les prix », choix entre barre grise et flou" width="290">

_Extension indépendante : ni éditée ni approuvée par Amazon._

## Installer

Firefox 140 ou plus récent.

| Façon                                       | Durée                    | Ce qu'il faut                                                                                                                                             |
| ------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Temporaire**                              | jusqu'au redémarrage     | `about:debugging#/runtime/this-firefox` → _Charger un module complémentaire temporaire…_ → choisir `extension/manifest.json`                              |
| **Essai en un geste**                       | le temps de la session   | `npm install` puis `npm start` : ouvre Firefox sur amazon.fr, extension chargée, rechargée à chaque modification                                         |
| **Permanente, pour soi**                    | définitive               | signer sans publier : clés d'API sur [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/), puis `npx web-ext sign --channel unlisted --source-dir extension` |
| **Permanente, pour tout le monde**          | définitive               | publier sur addons.mozilla.org (`--channel listed`), après relecture par Mozilla                                                                         |

Firefox refuse d'installer durablement une extension non signée, sauf dans
Developer Edition ou Nightly avec `xpinstall.signatures.required` à `false`.

## Ce qui est masqué

- les prix des résultats de recherche, des fiches produit et des meilleures
  ventes — ces trois pages sont vérifiées par `npm run verifier` ;
- ceux des listes d'envies, du panier et des commandes, qui passent par les
  mêmes composants et le même repérage — mais demandent d'être connecté : le
  script ne les visite pas ;
- les prix barrés (« Prix conseillé », « Prix le plus bas récent ») ;
- les prix sous les variantes (couleur, taille, format) ;
- tout montant écrit en clair : « 3 neufs à partir de 12,99 € », « Livraison
  GRATUITE dès 35 € », « Payez en plusieurs fois dès 35 € », filtres « de 10 à
  20 EUR »…

L'extension s'active sur les 23 boutiques Amazon (.fr, .com, .de, .co.uk, .it,
.es, .ca, .co.jp, .in…) et reconnaît les euros, dollars, livres, yens, roupies,
zlotys, couronnes, livres turques et codes ISO (`EUR 12,99`, `AED 49.00`). Seule
amazon.fr a été vérifiée sur le vrai site ; les autres le sont par
`BOUTIQUE=https://www.amazon.de npm run verifier`.

**Restent visibles, volontairement** : les remises en pourcentage (« -50 % »),
les notes, les nombres d'avis et les stocks. On masque des montants, pas les
promotions ; et un nombre sans devise n'est jamais pris pour un prix.

## Comment ça marche

Deux couches, qui se complètent.

1. **Une feuille de style** ([`masquage.css`](extension/content/masquage.css)),
   injectée avant que la page ne s'affiche. Elle couvre les composants de prix
   d'Amazon (`.a-price`, `.a-text-price`…) — y compris les prix éclatés en
   morceaux (« 29 » « , » « 99 » « € ») qu'aucune recherche dans le texte ne
   verrait. Elle **échoue fermée** : le masquage vaut tant que la page ne porte
   pas `data-sans-prix="off"`, que le script ne pose qu'après avoir lu les
   réglages. Les prix ne clignotent jamais au chargement.

2. **Un repérage dans le texte** ([`masquage.js`](extension/content/masquage.js)
   et [`detection.js`](extension/content/detection.js)) pour les montants écrits
   en clair. Ils sont recouverts par l'[API CSS Custom
   Highlight](https://developer.mozilla.org/fr/docs/Web/API/CSS_Custom_Highlight_API) :
   aucune balise ajoutée, aucun nœud découpé. Amazon rend une partie de ses pages
   avec React, qui garde la main sur ses nœuds texte — les envelopper dans un
   `<span>` casserait ses mises à jour. Un `MutationObserver` suit les
   carrousels et le défilement infini.

## Confidentialité

L'extension ne collecte, n'envoie ni ne lit rien d'autre que les pages Amazon
qu'elle masque. Aucune requête réseau. Elle conserve deux réglages
(`actif`, `style`) dans `storage.sync`, qui suivent le compte Firefox s'il est
synchronisé. Le manifeste le déclare (`data_collection_permissions: none`).

## Limites connues

- Un prix dessiné dans une **image** (bannière, visuel promotionnel) reste
  visible.
- Une publicité servie dans un cadre d'un **autre domaine** qu'Amazon
  (`amazon-adsystem.com`…) n'est pas couverte : l'extension ne demande l'accès
  qu'aux boutiques.
- Amazon change son balisage sans prévenir. Un nouveau composant de prix éclaté
  en morceaux passera tant que la feuille ne le connaît pas — c'est ce que
  `npm run verifier` détecte.

## Développer

```bash
npm install
```

```bash
npm test          # repérage des montants : ce qui est pris, ce qui est laissé
```

```bash
npm run lint      # validation du manifeste par web-ext (outil de Mozilla)
```

```bash
npm run verifier  # le vrai site, dans le Firefox du poste
```

```bash
npm run build     # paquet .zip dans web-ext-artifacts/
```

La CI ([`ci.yml`](.github/workflows/ci.yml)) joue les tests, `web-ext lint`
(qui y échoue sur un avertissement) et l'empaquetage, sur chaque PR et sur
`main` ; une seconde garde refuse les signatures d'assistant dans les commits et
les fichiers. Les deux sont exigées pour fusionner. `npm run verifier`, qui
dépend du vrai site, se lance à la main.

`npm run verifier` lance Firefox sur un profil jetable, extension installée,
ouvre une recherche, les meilleures ventes et une fiche produit, et **relève
chaque montant encore lisible** — ni sous une barre, ni flouté, ni hors écran.
Il bascule ensuite l'interrupteur et l'apparence depuis le popup et vérifie que
la page suit. Captures dans `captures/`. Variables : `BOUTIQUE`
(`https://www.amazon.de`…), `RECHERCHE`, `FIREFOX` (chemin de l'exécutable),
`VISIBLE=1` pour voir la fenêtre.

Pour ouvrir le popup, le script passe par la fenêtre de Firefox elle-même
(`MOZ_REMOTE_ALLOW_SYSTEM_ACCESS`, sur le seul profil jetable) : WebDriver BiDi
refuse de naviguer vers une adresse `moz-extension://`. Si Amazon répond par une
vérification anti-robot, le script s'arrête sans la contourner ; `VISIBLE=1`
permet de la passer soi-même.

```
extension/
├── manifest.json          MV3, Firefox 140+
├── background.js          raccourci clavier, pastille « off » sur l'icône
├── commun/reglages.js     réglages partagés (storage.sync)
├── content/
│   ├── masquage.css       la feuille : composants de prix, barre ou flou
│   ├── detection.js       repérage des montants dans un texte
│   └── masquage.js        surlignage des montants, suivi des réglages
├── popup/                 interrupteur et apparence
├── icons/icone.svg
└── _locales/              fr (par défaut), en
```

## Licence

[MIT](LICENSE)
