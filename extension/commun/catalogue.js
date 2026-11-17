/**
 * Le catalogue des règles, indépendant de la version de l'extension.
 *
 * Deux sources :
 *   - le catalogue EMBARQUÉ (regles.js), toujours là, lu sans attendre : c'est
 *     lui que la feuille de masquage pose dès document_start ;
 *   - le catalogue DISTANT, `regles/regles.json` sur la branche main du dépôt,
 *     que l'arrière-plan lit une fois par jour et garde dans storage.local.
 *
 * Le catalogue retenu est le plus récent (`revision`) de ceux dont l'extension
 * sait lire le `format`. Publier une correction de sélecteur ou un site nouveau,
 * c'est donc fusionner une PR qui modifie le catalogue et monte sa révision :
 * les installations la reçoivent dans la journée, sans nouvelle version. Une
 * version ne monte plus que si le moteur ou le format changent.
 *
 * Un catalogue distant n'est adopté qu'après une validation stricte : un seul
 * défaut, et il est rejeté en entier — le précédent reste. Ce sont des DONNÉES
 * (des noms de domaines, des sélecteurs CSS), jamais du code : rien n'y est
 * exécuté, les sélecteurs ne servent qu'à `querySelectorAll` et à une feuille
 * de style dont ils ne peuvent pas sortir (ni accolade, ni commentaire,
 * parenthèses et crochets équilibrés).
 *
 * Partagé par les content scripts, le popup, la page des nouveautés et
 * l'arrière-plan.
 */
(() => {
  "use strict";

  /** Les formats que ce moteur sait lire. Un format 2 demandera une version. */
  const FORMATS_LUS = Object.freeze([1]);
  const URL_DISTANTE = "https://raw.githubusercontent.com/mister-guiiug/mister-no-prices/main/regles/regles.json";
  const CLE = "catalogue";
  const REVISION = /^(\d{4})-(\d{2})-(\d{2})\.(\d{1,4})$/;
  const MAX_REGLES = 500;
  const MAX_SELECTEURS = 100;

  const EMBARQUE = Object.freeze({
    format: globalThis.SansPrixReglesVersion.format,
    revision: globalThis.SansPrixReglesVersion.revision,
    regles: globalThis.SansPrixRegles,
    source: "embarque",
  });

  /** -1, 0 ou 1, comme un tri. Le rang du jour se compare en nombre : .2 < .10. */
  function comparerRevisions(a, b) {
    const [, ...pa] = REVISION.exec(a) ?? [];
    const [, ...pb] = REVISION.exec(b) ?? [];
    if (pa.length === 0 || pb.length === 0) throw new Error(`révision illisible : ${pa.length ? b : a}`);
    for (let i = 0; i < 4; i += 1) {
      const d = Number(pa[i]) - Number(pb[i]);
      if (d !== 0) return Math.sign(d);
    }
    return 0;
  }

  // --- La validation --------------------------------------------------------

  const DOMAINE = /^(?!www\.)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
  const HOTE = /^[a-z0-9-]+(\.[a-z0-9-]+){2,}$/;
  const CHEMIN = /^(\/[\w.-]+)+$/;
  const ID = /^[a-z0-9-]{1,40}$/;

  /** Un sélecteur qui ne peut pas sortir de sa place dans la feuille. */
  function selecteurSur(s) {
    if (typeof s !== "string" || s.length === 0 || s.length > 300 || s !== s.trim()) return false;
    if (/[{};<\\]|\/\*|\*\//.test(s)) return false;
    // Parenthèses et crochets équilibrés, hors chaînes entre guillemets : un
    // « ) » de trop fermerait le `:is(` de la feuille.
    const pile = [];
    let guillemet = null;
    for (const c of s) {
      if (guillemet) {
        if (c === guillemet) guillemet = null;
      } else if (c === '"' || c === "'") guillemet = c;
      else if (c === "(" || c === "[") pile.push(c);
      else if (c === ")" && pile.pop() !== "(") return false;
      else if (c === "]" && pile.pop() !== "[") return false;
    }
    return pile.length === 0 && guillemet === null;
  }

  function listeDe(valeur, motif, nom, id) {
    if (valeur == null) return [];
    if (!Array.isArray(valeur)) throw new Error(`${id} : ${nom} doit être une liste`);
    for (const v of valeur) {
      if (typeof v !== "string" || !motif.test(v)) throw new Error(`${id} : ${nom} invalide « ${v} »`);
    }
    return [...valeur];
  }

  /** Une règle validée, à la forme de regles.js (figée). */
  function validerRegle(brute, vus) {
    if (!brute || typeof brute !== "object") throw new Error("règle qui n'est pas un objet");
    const { id, nom } = brute;
    if (typeof id !== "string" || !ID.test(id)) throw new Error(`id invalide « ${id} »`);
    if (vus.ids.has(id)) throw new Error(`id en double « ${id} »`);
    vus.ids.add(id);
    if (typeof nom !== "string" || !nom.trim() || nom.length > 60) throw new Error(`${id} : nom invalide`);

    const domaines = listeDe(brute.domaines, DOMAINE, "domaine", id);
    const hotes = listeDe(brute.hotes, HOTE, "hôte", id);
    if (domaines.length + hotes.length === 0) throw new Error(`${id} : ni domaine ni hôte`);
    for (const d of [...domaines, ...hotes]) {
      if (vus.domaines.has(d)) throw new Error(`${id} : « ${d} » déjà couvert`);
      vus.domaines.add(d);
    }
    const chemins = brute.chemins == null ? null : listeDe(brute.chemins, CHEMIN, "chemin", id);
    if (chemins && chemins.length === 0) throw new Error(`${id} : chemins vides`);

    if (!Array.isArray(brute.masquer) || brute.masquer.length > MAX_SELECTEURS) {
      throw new Error(`${id} : masquer doit être une liste de ${MAX_SELECTEURS} sélecteurs au plus`);
    }
    for (const s of brute.masquer) if (!selecteurSur(s)) throw new Error(`${id} : sélecteur refusé « ${s} »`);

    let fiche = null;
    if (brute.fiche != null) {
      if (typeof brute.fiche !== "object" || Array.isArray(brute.fiche)) throw new Error(`${id} : fiche invalide`);
      for (const [cle, s] of Object.entries(brute.fiche)) {
        if (!["titre", "prix", "image"].includes(cle)) throw new Error(`${id} : fiche.${cle} inconnu`);
        if (!selecteurSur(s)) throw new Error(`${id} : fiche.${cle} refusé « ${s} »`);
      }
      if (!brute.fiche.titre) throw new Error(`${id} : fiche sans titre`);
      fiche = Object.freeze({ ...brute.fiche });
    }

    return Object.freeze({
      id,
      nom: nom.trim(),
      domaines: Object.freeze(domaines),
      hotes: Object.freeze(hotes),
      chemins: chemins ? Object.freeze(chemins) : null,
      masquer: Object.freeze([...brute.masquer]),
      fiche,
    });
  }

  /**
   * Le catalogue validé et figé, ou une erreur qui dit son premier défaut.
   * @param {unknown} brut le JSON lu
   * @param {string} source « distant », « cache »…
   */
  function valider(brut, source = "distant") {
    if (!brut || typeof brut !== "object") throw new Error("catalogue qui n'est pas un objet");
    if (!FORMATS_LUS.includes(brut.format)) throw new Error(`format ${brut.format} illisible par cette version`);
    if (typeof brut.revision !== "string" || !REVISION.test(brut.revision)) {
      throw new Error(`révision invalide « ${brut.revision} »`);
    }
    if (!Array.isArray(brut.regles) || brut.regles.length === 0 || brut.regles.length > MAX_REGLES) {
      throw new Error("regles doit être une liste non vide");
    }
    const vus = { ids: new Set(), domaines: new Set() };
    return Object.freeze({
      format: brut.format,
      revision: brut.revision,
      regles: Object.freeze(brut.regles.map((r) => validerRegle(r, vus))),
      source,
    });
  }

  /** Le plus récent des catalogues donnés ; à révision égale, le premier. */
  function choisir(...catalogues) {
    return catalogues
      .filter(Boolean)
      .reduce((retenu, c) => (comparerRevisions(c.revision, retenu.revision) > 0 ? c : retenu));
  }

  // --- Le cache et le téléchargement -----------------------------------------

  /** Le catalogue en cache, validé, ou null. */
  async function lireCache() {
    const { [CLE]: brut } = await browser.storage.local.get(CLE);
    if (!brut) return null;
    try {
      return valider(brut, "cache");
    } catch {
      return null; // un cache d'un format que cette version ne lit plus
    }
  }

  /** Le catalogue à appliquer : l'embarqué, ou le cache s'il est plus récent. */
  async function lire() {
    return choisir(EMBARQUE, await lireCache());
  }

  /**
   * Lit le catalogue distant et l'adopte s'il est valide et plus récent que
   * celui qu'on applique. Ne lève pas : rend ce qui s'est passé.
   * @returns {Promise<{statut: "adopte"|"inchange"|"rejete"|"injoignable", revision?: string, erreur?: string}>}
   */
  async function telecharger(url = URL_DISTANTE) {
    let brut;
    try {
      const reponse = await fetch(url, { cache: "no-cache", credentials: "omit", referrerPolicy: "no-referrer" });
      if (!reponse.ok) return { statut: "injoignable", erreur: `HTTP ${reponse.status}` };
      brut = await reponse.json();
    } catch (erreur) {
      return { statut: "injoignable", erreur: String(erreur?.message ?? erreur) };
    }
    let distant;
    try {
      distant = valider(brut);
    } catch (erreur) {
      return { statut: "rejete", erreur: erreur.message };
    }
    const actuel = await lire();
    if (comparerRevisions(distant.revision, actuel.revision) <= 0) {
      return { statut: "inchange", revision: actuel.revision };
    }
    await browser.storage.local.set({ [CLE]: brut });
    return { statut: "adopte", revision: distant.revision };
  }

  /** Oublie le catalogue distant : l'embarqué reprend la main. */
  function oublier() {
    return browser.storage.local.remove(CLE);
  }

  /** Rappelle `rappel(catalogue)` quand le cache change. */
  function suivre(rappel) {
    browser.storage.onChanged.addListener((changements, zone) => {
      if (zone === "local" && CLE in changements) lire().then(rappel, console.error);
    });
  }

  globalThis.SansPrixCatalogue = Object.freeze({
    FORMATS_LUS,
    URL_DISTANTE,
    EMBARQUE,
    comparerRevisions,
    selecteurSur,
    valider,
    choisir,
    lire,
    telecharger,
    oublier,
    suivre,
  });
})();
