/**
 * Le moteur de règles, en fonctions pures : choisir la règle d'un site et en
 * tirer la feuille de masquage. Rien ici ne touche au document — c'est
 * masquage.js qui l'applique —, ce qui permet de l'éprouver sous Node.
 */
(() => {
  "use strict";

  /** Attribut posé sur le parent d'un prix éclaté en morceaux (« 34 » « €99 »). */
  const ATTRIBUT_ECLATE = "data-sans-prix-eclate";

  /**
   * La règle qui couvre `hote`, ou `null` : par un de ses `hotes` exacts, ou
   * par un de ses `domaines` (lui-même ou un sous-domaine). « amazon.fr »
   * couvre www.amazon.fr, pas mon-amazon.fr ; « www.google.fr » ne couvre que
   * lui-même, pas mail.google.fr.
   */
  function trouverRegle(hote, regles) {
    const h = hote.toLowerCase().replace(/\.$/, "");
    return (
      regles.find(
        (r) => r.hotes.includes(h) || r.domaines.some((d) => h === d || h.endsWith(`.${d}`)),
      ) ?? null
    );
  }

  /** Les motifs de correspondance que le manifeste doit déclarer pour ces règles. */
  function motifsDuManifeste(regles) {
    return regles.flatMap((r) => [
      ...r.domaines.map((d) => `*://*.${d}/*`),
      ...r.hotes.map((h) => `*://${h}/*`),
    ]);
  }

  /**
   * La feuille qui couvre les sélecteurs donnés, plus les prix éclatés.
   *
   * Elle échoue FERMÉE : le masquage vaut tant que <html> ne porte pas
   * data-sans-prix="off", que masquage.js ne pose qu'après avoir lu les
   * réglages. Les sélecteurs sont réunis dans un `:is()`, liste tolérante : un
   * sélecteur invalide y est ignoré sans emporter les autres.
   */
  function construireFeuille(selecteurs) {
    const liste = [...selecteurs, `[${ATTRIBUT_ECLATE}]`].join(",\n    ");
    return `:root:not([data-sans-prix="off"]) :is(
    ${liste}
) {
  text-shadow: none !important;

  /* Barre grise (par défaut) : la place reste, le texte disparaît. Le trait
     d'un prix barré a sa propre couleur : il faut l'éteindre aussi. */
  :root:not([data-sans-prix-style="flou"]) & {
    color: transparent !important;
    text-decoration-color: transparent !important;
    background: #d5d9d9 !important;
    border-radius: 0.25em !important;

    & * {
      color: transparent !important;
      text-decoration-color: transparent !important;
      background: transparent !important;
      border-color: transparent !important;
      text-shadow: none !important;
    }
  }

  /* Flou : la forme reste, les chiffres ne se lisent plus. */
  :root[data-sans-prix-style="flou"] & {
    filter: blur(0.35em) !important;
  }
}
`;
  }

  globalThis.SansPrixMoteur = Object.freeze({
    ATTRIBUT_ECLATE,
    trouverRegle,
    motifsDuManifeste,
    construireFeuille,
  });
})();
