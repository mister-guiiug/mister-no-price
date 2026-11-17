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

  /**
   * Les articles, dans l'ordre de la liste : le plus récent en tête, sauf si le
   * parent les a rangés (`deplacer`). Chacun peut porter `pour`, le prénom de
   * l'enfant à qui il est destiné.
   */
  async function lire() {
    const { [CLE]: liste } = await browser.storage.local.get({ [CLE]: [] });
    return Array.isArray(liste) ? liste.filter(valide) : [];
  }

  /**
   * Ajoute un article en tête, repéré par son adresse. Déjà dans la liste, il
   * est mis à jour sur place (titre, prix…) : il garde son rang, que le parent
   * a pu choisir, et son prénom.
   */
  async function ajouter({ url, titre, image = null, prix = null, devise = null, site = null }) {
    const liste = await lire();
    const frais = { url, titre, image, prix, devise, site };
    const rang = liste.findIndex((a) => a.url === url);
    if (rang >= 0) liste[rang] = { ...liste[rang], ...frais };
    else liste.unshift({ ...frais, ajoute: Date.now() });
    await browser.storage.local.set({ [CLE]: liste.slice(0, MAX) });
  }

  /** Change le prénom (`pour`) d'un article ; une chaîne vide le retire. */
  async function modifier(url, { pour }) {
    const liste = await lire();
    const article = liste.find((a) => a.url === url);
    if (!article) return;
    const prenom = typeof pour === "string" ? pour.trim().slice(0, 40) : "";
    if (prenom) article.pour = prenom;
    else delete article.pour;
    await browser.storage.local.set({ [CLE]: liste });
  }

  /** Déplace un article d'un rang (`-1` : vers le haut, `1` : vers le bas). */
  async function deplacer(url, sens) {
    const liste = await lire();
    const de = liste.findIndex((a) => a.url === url);
    const vers = de + Math.sign(sens);
    if (de < 0 || vers < 0 || vers >= liste.length) return;
    [liste[de], liste[vers]] = [liste[vers], liste[de]];
    await browser.storage.local.set({ [CLE]: liste });
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

  globalThis.SansPrixEnvies = Object.freeze({
    MAX,
    lire,
    ajouter,
    modifier,
    deplacer,
    retirer,
    vider,
    contient,
    suivre,
  });
})();
