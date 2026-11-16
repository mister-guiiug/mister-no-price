/**
 * Applique les règles à la page : la feuille du site, puis trois mécanismes
 * génériques, valables partout.
 *
 * 1. La feuille du site, tirée de sa règle (regles.js) par le moteur
 *    (moteur.js), posée dès document_start : les composants de prix connus sont
 *    couverts avant le premier affichage.
 * 2. Les montants écrits en clair (« 3 neufs à partir de 12,99 € ») sont
 *    recouverts par l'API CSS Custom Highlight : une plage par montant, peinte
 *    par ::highlight(sans-prix). Aucune balise ajoutée, aucun nœud texte
 *    découpé — plusieurs de ces sites rendent leurs pages avec React ou Vue, qui
 *    gardent la main sur leurs nœuds texte : les envelopper dans un <span>
 *    casserait leurs mises à jour.
 * 3. Un prix éclaté en morceaux (« 34 » « €99 », « 12 » « , » « 99 » « € »)
 *    échappe à la recherche nœud par nœud. Quand un nœud n'est qu'un morceau, on
 *    remonte à l'ancêtre proche dont le texte entier est un montant, et on le
 *    marque d'un attribut que la feuille couvre. Un attribut ne déplace aucun
 *    nœud.
 * 4. Le titre de l'onglet perd ses montants (« Robot 999€ chez … »).
 *
 * Le script suit aussi les réglages (actif, apparence) et les applique en direct.
 */
(() => {
  "use strict";

  const { lire, suivre } = globalThis.SansPrixReglages;
  const { contientChiffre, trouverMontants, masquerMontants, estFragment } =
    globalThis.SansPrixDetection;
  const { ATTRIBUT_ECLATE, trouverRegle, construireFeuille } = globalThis.SansPrixMoteur;

  const NOM = "sans-prix";
  const IGNORES = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "TITLE"]);
  // Au-delà, l'ancêtre n'est plus un prix mais une ligne, voire une carte.
  const LONGUEUR_MAX_ECLATE = 30;
  const NIVEAUX_MAX_ECLATE = 3;

  const reglages = { actif: true, style: "barre" };

  // --- 1. La feuille du site ----------------------------------------------

  const regle = trouverRegle(location.hostname, globalThis.SansPrixRegles);
  const feuille = document.createElement("style");
  feuille.setAttribute("data-sans-prix", "");
  feuille.textContent = construireFeuille(regle?.masquer ?? []);

  // Accrochée à <html> plutôt qu'à <head> : une application qui remplace son
  // <head> ne l'emporte pas. Si elle disparaît quand même, on la remet.
  function poserFeuille() {
    if (feuille.isConnected) return;
    const racine = document.documentElement;
    if (racine) racine.append(feuille);
  }
  poserFeuille();

  // --- 2. Les montants dans le texte ----------------------------------------

  const surlignage = new Highlight();
  /** @type {WeakMap<Text, Range[]>} plages posées sur chaque nœud, pour les retirer */
  const plagesParNoeud = new WeakMap();
  /** @type {Set<Range>} toutes les plages, pour purger celles des nœuds retirés */
  const plages = new Set();

  function oublier(noeud) {
    const anciennes = plagesParNoeud.get(noeud);
    if (!anciennes) return;
    for (const plage of anciennes) {
      surlignage.delete(plage);
      plages.delete(plage);
    }
    plagesParNoeud.delete(noeud);
  }

  // --- 3. Les prix éclatés ----------------------------------------------------

  const chiffres = (texte) => texte.replace(/\D/g, "");

  /**
   * Depuis un morceau (« 34 », « €99 », « , »), remonte au premier ancêtre
   * proche qui forme un montant ET apporte d'autres chiffres que le morceau
   * (« 34€99 »), et le marque. Comparer les chiffres, et non le texte, laisse
   * « Prix : 12,99 € » tranquille : le libellé n'ajoute aucun chiffre, et le
   * montant est déjà couvert par le repérage dans le texte.
   *
   * Tous les morceaux remontent, complets ou non : l'ordre d'arrivée des nœuds
   * ne compte pas (« €99 » inséré après « 34 » marque le même parent).
   */
  function marquerEclate(noeud) {
    const morceau = chiffres(noeud.data);
    let courant = noeud.parentElement;
    for (let niveau = 0; niveau < NIVEAUX_MAX_ECLATE && courant; niveau += 1) {
      if (courant === document.body || courant === document.documentElement) return;
      const texte = courant.textContent.trim();
      if (texte.length > LONGUEUR_MAX_ECLATE) return;
      if (chiffres(texte) !== morceau && trouverMontants(texte).length > 0) {
        courant.setAttribute(ATTRIBUT_ECLATE, "");
        return;
      }
      courant = courant.parentElement;
    }
  }

  function traiterTexte(noeud) {
    oublier(noeud);
    const texte = noeud.data;
    if (!contientChiffre(texte) && !estFragment(texte)) return;
    const parent = noeud.parentElement;
    if (!parent || IGNORES.has(parent.nodeName)) return;

    if (estFragment(texte)) marquerEclate(noeud);

    const nouvelles = [];
    for (const { debut, fin } of trouverMontants(texte)) {
      const plage = document.createRange();
      plage.setStart(noeud, debut);
      plage.setEnd(noeud, fin);
      surlignage.add(plage);
      plages.add(plage);
      nouvelles.push(plage);
    }
    if (nouvelles.length > 0) plagesParNoeud.set(noeud, nouvelles);
  }

  function parcourir(racine) {
    if (racine.nodeType === Node.TEXT_NODE) {
      traiterTexte(racine);
      return;
    }
    if (racine.nodeType !== Node.ELEMENT_NODE) return;
    if (IGNORES.has(racine.nodeName)) return;
    const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    for (let noeud = marcheur.nextNode(); noeud; noeud = marcheur.nextNode()) {
      traiterTexte(noeud);
    }
  }

  // Une plage sur un nœud retiré ne se peint plus, mais le retient en mémoire :
  // sur une page à défilement infini, on purge de temps en temps.
  let purgePrevue = false;
  function prevoirPurge() {
    if (purgePrevue) return;
    purgePrevue = true;
    setTimeout(() => {
      purgePrevue = false;
      for (const plage of plages) {
        if (plage.startContainer.isConnected) continue;
        surlignage.delete(plage);
        plages.delete(plage);
      }
    }, 10_000);
  }

  // --- 4. Le titre de l'onglet ------------------------------------------------

  let titreEcrit = null; // le titre tel que nous l'avons posé
  let titreDeLaPage = ""; // le titre tel que la page l'a voulu

  function majTitre() {
    const courant = document.title;
    if (courant !== titreEcrit) titreDeLaPage = courant;
    const voulu = reglages.actif ? masquerMontants(titreDeLaPage) : titreDeLaPage;
    titreEcrit = voulu;
    if (courant !== voulu) document.title = voulu;
  }

  // --- Suivi de la page -------------------------------------------------------

  // Les rappels d'un MutationObserver passent avant le rendu suivant : un montant
  // inséré par la page est couvert avant d'avoir été peint.
  const observateur = new MutationObserver((mutations) => {
    let retraits = false;
    let titre = false;
    for (const mutation of mutations) {
      const cible = mutation.target;
      if (mutation.type === "attributes") {
        poserAttributs();
        continue;
      }
      if (cible.nodeName === "TITLE" || cible.parentNode?.nodeName === "TITLE") titre = true;
      if (mutation.type === "characterData") {
        if (cible.nodeType === Node.TEXT_NODE) traiterTexte(cible);
        continue;
      }
      for (const ajout of mutation.addedNodes) {
        if (ajout.nodeName === "TITLE") titre = true;
        parcourir(ajout);
      }
      if (mutation.removedNodes.length > 0) retraits = true;
    }
    poserFeuille();
    if (titre) majTitre();
    if (retraits) prevoirPurge();
  });
  // Les attributs de réglage sur <html> aussi : une application qui hydrate sa
  // page (Decathlon, en Vue) réécrit ceux de <html> et efface les nôtres. Le
  // masquage tiendrait — la feuille échoue fermée —, mais le flou ou la pause
  // choisis seraient perdus.
  observateur.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-sans-prix", "data-sans-prix-style"],
  });

  if (document.documentElement) parcourir(document.documentElement);
  // Filet : l'analyseur HTML peut compléter un nœud texte déjà inséré sans le
  // signaler. Un dernier passage complet, une fois le document construit.
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      poserFeuille();
      parcourir(document.body ?? document.documentElement);
      majTitre();
    },
    { once: true },
  );

  // --- Réglages ---------------------------------------------------------------

  let reglagesLus = false;

  /** Pose les attributs de réglage sur <html>, s'ils n'y sont pas déjà. */
  function poserAttributs() {
    const racine = document.documentElement;
    if (!reglagesLus || !racine) return;
    const voulus = {
      "data-sans-prix": reglages.actif ? "on" : "off",
      "data-sans-prix-style": reglages.style,
    };
    // Comparer avant d'écrire : réécrire la même valeur notifierait encore
    // l'observateur, qui rappellerait cette fonction, sans fin.
    for (const [nom, valeur] of Object.entries(voulus)) {
      if (racine.getAttribute(nom) !== valeur) racine.setAttribute(nom, valeur);
    }
  }

  function appliquer({ actif, style }) {
    reglages.actif = actif;
    reglages.style = style;
    reglagesLus = true;
    const racine = document.documentElement;
    if (!racine) {
      document.addEventListener("DOMContentLoaded", () => appliquer({ actif, style }), {
        once: true,
      });
      return;
    }
    poserAttributs();
    if (actif) CSS.highlights.set(NOM, surlignage);
    else CSS.highlights.delete(NOM);
    majTitre();
  }

  // Échoue fermé, comme la feuille : masqué tant que les réglages ne sont pas lus.
  CSS.highlights.set(NOM, surlignage);
  lire().then(appliquer, console.error);
  suivre(appliquer);
})();
