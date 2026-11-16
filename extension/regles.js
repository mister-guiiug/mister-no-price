/**
 * Les règles par site : la seule chose à écrire pour en ajouter un.
 *
 * Une règle, c'est :
 *   - `id`       : identifiant stable, en minuscules ;
 *   - `nom`      : ce qu'affiche le popup ;
 *   - `domaines` : les domaines couverts, sous-domaines compris (« amazon.fr »
 *                  couvre www.amazon.fr) — le manifeste doit les déclarer tous,
 *                  un test le vérifie ;
 *   - `masquer`  : les sélecteurs CSS des éléments qui ne contiennent QUE des
 *                  prix. Ils sont couverts avant le premier affichage.
 *
 * Tout le reste est générique et vaut sur chaque site, règle ou non :
 *   - les montants écrits en clair (« dès 35 € ») sont repérés dans le texte ;
 *   - un prix éclaté en morceaux (« 34 » « €99 ») est reconnu à son parent ;
 *   - le titre de l'onglet perd ses montants.
 *
 * `masquer` ne sert donc qu'à deux choses : couvrir un prix avant le premier
 * affichage, et attraper un prix que le générique ne reconnaît pas. Un
 * sélecteur qui désigne aussi autre chose qu'un prix (le rouge `.a-color-price`
 * d'Amazon sert aussi à « Plus que 2 ex. en stock ») n'a rien à faire ici : le
 * repérage dans le texte ne couvre que le montant. Un sélecteur invalide est
 * ignoré sans casser les autres (ils sont réunis dans un `:is()`).
 */
(() => {
  "use strict";

  const REGLES = [
    {
      id: "amazon",
      nom: "Amazon",
      domaines: [
        "amazon.fr",
        "amazon.com",
        "amazon.it",
        "amazon.de",
        "amazon.co.uk",
        "amazon.es",
        "amazon.com.be",
        "amazon.nl",
        "amazon.ie",
        "amazon.se",
        "amazon.pl",
        "amazon.com.tr",
        "amazon.ca",
        "amazon.com.mx",
        "amazon.com.br",
        "amazon.co.jp",
        "amazon.in",
        "amazon.com.au",
        "amazon.sg",
        "amazon.ae",
        "amazon.sa",
        "amazon.eg",
        "amazon.co.za",
      ],
      masquer: [
        // Composant prix (recherche, fiche, listes, panier) et ses morceaux
        ".a-price",
        ".a-price-whole",
        ".a-price-fraction",
        ".a-price-decimal",
        ".a-price-symbol",
        // Prix barré : « Prix conseillé », « Prix le plus bas récent »
        ".a-text-price",
        // Meilleures ventes, nouveautés : classe hachée, préfixe stable
        '[class*="p13n-sc-price"]',
        // Fiche produit, anciennes mises en page encore servies
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        "#priceblock_saleprice",
        "#priceblock_pospromoprice",
        "#price_inside_buybox",
        "#newBuyBoxPrice",
        "#kindle-price",
        "#sns-base-price",
        "#tp_price_block_total_price_ww",
        // Prix sous les variantes (taille, couleur, format)
        ".twisterSwatchPrice",
        // Carrousel des vidéos de la fiche : « € » « 29 » « 99 » en trois morceaux
        ".vse-price-component",
        // Panier
        ".sc-price",
        ".sc-product-price",
        '[id^="sc-subtotal-amount"]',
      ],
    },
    {
      id: "dealabs",
      nom: "Dealabs",
      domaines: ["dealabs.com"],
      // Tout est écrit en clair, titres des bons plans compris : le repérage
      // dans le texte fait l'essentiel. Ces deux-là évitent le clignotement.
      masquer: [".thread-price", ".threadItemCard-price"],
    },
    {
      id: "decathlon",
      nom: "Decathlon",
      domaines: [
        "decathlon.fr",
        "decathlon.be",
        "decathlon.ch",
        "decathlon.com",
        "decathlon.co.uk",
        "decathlon.de",
        "decathlon.es",
        "decathlon.it",
        "decathlon.nl",
        "decathlon.pl",
        "decathlon.pt",
      ],
      // Le composant prix du système de conception Vitamin : prix, prix barré,
      // remise en euros (« -30 € »), mention « prix le plus bas ».
      masquer: [
        ".vp-price-amount",
        ".vp-price-barred-amount",
        ".vp-price-discount",
        ".vp-price-helper",
      ],
    },
    {
      id: "cdiscount",
      nom: "Cdiscount",
      domaines: ["cdiscount.com"],
      // Classes hachées (styled-components) ; seuls ces noms-là sont stables.
      // Les gros prix « 34 » « €99 » sans classe stable : prix éclatés, génériques.
      masquer: [".price", ".SecondaryPrice-price"],
    },
  ];

  globalThis.SansPrixRegles = Object.freeze(
    REGLES.map((regle) =>
      Object.freeze({
        ...regle,
        domaines: Object.freeze([...regle.domaines]),
        masquer: Object.freeze([...regle.masquer]),
      }),
    ),
  );
})();
