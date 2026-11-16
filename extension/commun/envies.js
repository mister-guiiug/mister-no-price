/**
 * La liste d'envies : les articles que l'enfant a marqués d'un ♥ sur les fiches
 * produit, pour que le parent les retrouve — prix compris — sur la page de la
 * liste.
 *
 * Rangée dans storage.local, pas storage.sync : une liste de deux cents
 * articles dépasserait les quotas de la synchronisation, et elle appartient à
 * l'appareil où l'enfant l'a faite.
 *
 * Partagé par le content script (le bouton ♥), le popup et la page de la liste.
 */
(() => {
  "use strict";

  const CLE = "envies";
  // Au-delà, les plus anciens tombent : une liste n'est pas un historique.
  const MAX = 200;

  const valide = (a) => a && typeof a.url === "string" && typeof a.titre === "string";

  /** Les articles, du plus récent au plus ancien. */
  async function lire() {
    const { [CLE]: liste } = await browser.storage.local.get({ [CLE]: [] });
    return Array.isArray(liste) ? liste.filter(valide) : [];
  }

  /** Ajoute (ou remonte en tête) un article, repéré par son adresse. */
  async function ajouter({ url, titre, image = null, prix = null, devise = null, site = null }) {
    const liste = (await lire()).filter((a) => a.url !== url);
    liste.unshift({ url, titre, image, prix, devise, site, ajoute: Date.now() });
    await browser.storage.local.set({ [CLE]: liste.slice(0, MAX) });
  }

  async function retirer(url) {
    await browser.storage.local.set({ [CLE]: (await lire()).filter((a) => a.url !== url) });
  }

  async function vider() {
    await browser.storage.local.remove(CLE);
  }

  async function contient(url) {
    return (await lire()).some((a) => a.url === url);
  }

  /** Rappelle `rappel(liste)` à chaque changement, depuis n'importe quel onglet. */
  function suivre(rappel) {
    browser.storage.onChanged.addListener((changements, zone) => {
      if (zone === "local" && CLE in changements) lire().then(rappel, console.error);
    });
  }

  globalThis.SansPrixEnvies = Object.freeze({ MAX, lire, ajouter, retirer, vider, contient, suivre });
})();
