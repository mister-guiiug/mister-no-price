/**
 * Réglages partagés par le content script, le popup et le script d'arrière-plan.
 *
 * Rangés dans storage.sync : ils suivent le compte Firefox d'un appareil à
 * l'autre, et restent locaux si la synchronisation est coupée.
 */
(() => {
  "use strict";

  const STYLES = Object.freeze(["barre", "flou"]);
  const DEFAUTS = Object.freeze({ actif: true, style: "barre" });

  function normaliser(brut) {
    return {
      // Tout ce qui n'est pas explicitement `false` masque : en cas de doute, on cache.
      actif: brut.actif !== false,
      style: STYLES.includes(brut.style) ? brut.style : DEFAUTS.style,
    };
  }

  async function lire() {
    return normaliser(await browser.storage.sync.get(DEFAUTS));
  }

  function ecrire(partiel) {
    return browser.storage.sync.set(partiel);
  }

  /** Rappelle `rappel(reglages)` à chaque changement, depuis n'importe quel onglet. */
  function suivre(rappel) {
    browser.storage.onChanged.addListener((changements, zone) => {
      if (zone !== "sync") return;
      if (!("actif" in changements) && !("style" in changements)) return;
      lire().then(rappel, console.error);
    });
  }

  globalThis.SansPrixReglages = Object.freeze({ STYLES, DEFAUTS, lire, ecrire, suivre });
})();
