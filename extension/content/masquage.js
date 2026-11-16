/**
 * Masque les montants écrits en clair, que la feuille masquage.css n'attrape pas
 * (« 3 neufs à partir de 12,99 € », « Sous-total : 45,98 € », filtres de prix).
 *
 * Ils sont recouverts par l'API CSS Custom Highlight : une plage par montant,
 * peinte par la règle ::highlight(sans-prix). Aucune balise n'est ajoutée, aucun
 * nœud texte découpé — Amazon rend une partie de ses pages avec React, qui garde
 * la main sur ses nœuds texte : les envelopper dans un <span> casserait ses mises
 * à jour.
 *
 * Le script suit aussi les réglages (actif, apparence) et les applique en direct.
 */
(() => {
  "use strict";

  const { lire, suivre } = globalThis.SansPrixReglages;
  const { contientChiffre, trouverMontants } = globalThis.SansPrixDetection;

  const NOM = "sans-prix";
  const IGNORES = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA"]);

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

  function traiterTexte(noeud) {
    oublier(noeud);
    const texte = noeud.data;
    if (!contientChiffre(texte)) return;
    const parent = noeud.parentNode;
    if (!parent || IGNORES.has(parent.nodeName)) return;

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

  // Les rappels d'un MutationObserver passent avant le rendu suivant : un montant
  // inséré par la page est couvert avant d'avoir été peint.
  const observateur = new MutationObserver((mutations) => {
    let retraits = false;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        if (mutation.target.nodeType === Node.TEXT_NODE) traiterTexte(mutation.target);
        continue;
      }
      for (const ajout of mutation.addedNodes) parcourir(ajout);
      if (mutation.removedNodes.length > 0) retraits = true;
    }
    if (retraits) prevoirPurge();
  });
  observateur.observe(document, { childList: true, subtree: true, characterData: true });

  if (document.documentElement) parcourir(document.documentElement);
  // Filet : l'analyseur HTML peut compléter un nœud texte déjà inséré sans le
  // signaler. Un dernier passage complet, une fois le document construit.
  document.addEventListener(
    "DOMContentLoaded",
    () => parcourir(document.body ?? document.documentElement),
    { once: true },
  );

  function appliquer({ actif, style }) {
    const racine = document.documentElement;
    if (!racine) {
      document.addEventListener("DOMContentLoaded", () => appliquer({ actif, style }), {
        once: true,
      });
      return;
    }
    racine.setAttribute("data-sans-prix", actif ? "on" : "off");
    racine.setAttribute("data-sans-prix-style", style);
    if (actif) CSS.highlights.set(NOM, surlignage);
    else CSS.highlights.delete(NOM);
  }

  // Échoue fermé, comme la feuille : masqué tant que les réglages ne sont pas lus.
  CSS.highlights.set(NOM, surlignage);
  lire().then(appliquer, console.error);
  suivre(appliquer);
})();
