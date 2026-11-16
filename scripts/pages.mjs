/**
 * Les pages visitées : une liste, et le lien de la première fiche produit qu'on
 * y trouve. Pas dans regles.js : ce sont des données de test, pas l'extension.
 *
 * `fiche` peut être une liste de sélecteurs, essayés dans l'ordre. `envies:
 * false` : la « fiche » du site n'est pas un produit, pas de bouton ♥ attendu.
 */
// Le site mobile d'Amazon n'a pas toujours le conteneur des résultats ; le
// second sélecteur, plus large, attrape aussi les pages promotionnelles.
const LIEN_AMAZON = ['[data-component-type="s-search-result"] a[href*="/dp/"]', 'a[href*="/dp/"]:not([href*="/sspa/"])'];
export const PAGES = {
  "amazon.fr": { liste: "https://www.amazon.fr/s?k=casque+audio", fiche: LIEN_AMAZON },
  "amazon.com": { liste: "https://www.amazon.com/s?k=headphones", fiche: LIEN_AMAZON },
  "amazon.it": { liste: "https://www.amazon.it/s?k=cuffie", fiche: LIEN_AMAZON },
  "amazon.co.uk": { liste: "https://www.amazon.co.uk/s?k=headphones", fiche: LIEN_AMAZON },
  "amazon.de": { liste: "https://www.amazon.de/s?k=kopfhorer", fiche: LIEN_AMAZON },
  "amazon.es": { liste: "https://www.amazon.es/s?k=auriculares", fiche: LIEN_AMAZON },
  // Un bon plan est une discussion, pas une fiche produit.
  "dealabs.com": { liste: "https://www.dealabs.com/", fiche: 'a[href*="/bons-plans/"]', envies: false },
  "decathlon.fr": { liste: "https://www.decathlon.fr/search?Ntt=velo", fiche: 'a[href*="/p/"]' },
  "cdiscount.com": {
    liste: "https://www.cdiscount.com/search/10/casque+audio.html",
    fiche: 'a[href*="/f-"]',
  },
  "fnac.com": {
    liste: "https://www.fnac.com/SearchResult/ResultList.aspx?Search=casque+audio",
    fiche: "a.Article-title",
  },
  "darty.com": {
    liste: "https://www.darty.com/nav/recherche?text=casque+audio",
    fiche: 'a[href*="/nav/achat/"]',
  },
  "boulanger.com": {
    liste: "https://www.boulanger.com/resultats?tr=casque+audio",
    fiche: 'a[href*="/ref/"]',
  },
  "ldlc.com": { liste: "https://www.ldlc.com/recherche/casque%20audio/", fiche: 'a[href*="/fiche/"]' },
  "rueducommerce.fr": {
    liste: "https://www.rueducommerce.fr/recherche/casque%20audio/",
    fiche: 'a[href*="/p/r"]',
  },
  "e.leclerc": { liste: "https://www.e.leclerc/recherche?q=casque+audio", fiche: 'a[href*="/fp/"]' },
  "carrefour.fr": { liste: "https://www.carrefour.fr/s?q=casque+audio", fiche: 'a[href*="/p/"]' },
  "auchan.fr": { liste: "https://www.auchan.fr/recherche?text=casque+audio", fiche: 'a[href*="/pr-"]' },
  // rakuten.com : la place de marché française a fermé, rien à visiter.
  "ebay.fr": { liste: "https://www.ebay.fr/sch/i.html?_nkw=casque+audio", fiche: 'a[href*="/itm/"]:not([href*="/itm/123456"])' },
  "ebay.com": { liste: "https://www.ebay.com/sch/i.html?_nkw=headphones", fiche: 'a[href*="/itm/"]:not([href*="/itm/123456"])' },
  "aliexpress.com": {
    liste: "https://fr.aliexpress.com/w/wholesale-casque-audio.html",
    fiche: 'a[href*="/item/"]',
  },
  "zalando.fr": { liste: "https://www.zalando.fr/catalogue/?q=baskets", fiche: 'article a[href$=".html"]' },
  "manomano.fr": { liste: "https://www.manomano.fr/recherche/perceuse", fiche: 'a[href*="/p/"]' },
  // Pas de fiche produit : la recherche (produits sponsorisés) et Google Images.
  "google.fr": {
    urls: {
      recherche: "https://www.google.fr/search?q=casque+audio+bluetooth&hl=fr",
      images: "https://www.google.fr/search?q=casque+audio+bluetooth&udm=2&hl=fr",
    },
  },
};
