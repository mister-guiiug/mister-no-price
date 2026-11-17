/**
 * Ce que la publication demande à addons.mozilla.org (API v5), au-delà de ce
 * que fait `web-ext sign` : savoir si une version y est déjà, où en est sa
 * relecture, et télécharger le fichier signé une fois la version publiée.
 *
 * Une version du canal « listed » n'est signée qu'une fois approuvée : souvent
 * en quelques minutes, parfois après une relecture humaine de plusieurs jours.
 * La publication soumet, attend un peu, puis s'arrête sans release si la
 * version est encore en relecture ; ses passages suivants (planifiés) la
 * retrouvent ici et finissent le travail.
 *
 * https://addons-server.readthedocs.io/en/latest/topics/api/addons.html
 */
import { createHmac, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

export const API = "https://addons.mozilla.org/api/v5/";
const AGENT = "mister-no-prices-publication";

const base64url = (valeur) => Buffer.from(JSON.stringify(valeur)).toString("base64url");

/** Le jeton d'une requête : un JWT HS256 d'une minute, signé par le secret. */
export function jeton(cle, secret, maintenant = Math.floor(Date.now() / 1000)) {
  const corps = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({
    iss: cle,
    jti: randomUUID(),
    iat: maintenant,
    exp: maintenant + 60,
  })}`;
  return `${corps}.${createHmac("sha256", secret).update(corps).digest("base64url")}`;
}

/**
 * L'état d'une version d'après sa fiche dans l'API.
 * @returns {"publiee" | "en-relecture" | "refusee"}
 */
export function etatDe(version) {
  const statut = version?.file?.status;
  if (statut === "public") return "publiee";
  if (statut === "disabled") return "refusee";
  return "en-relecture";
}

export function client({ cle, secret, fetch = globalThis.fetch }) {
  const demander = async (url, attendu = "json", { methode = "GET", corps } = {}) => {
    const enJson = corps !== undefined && !(corps instanceof FormData);
    const reponse = await fetch(url, {
      method: methode,
      headers: {
        Authorization: `JWT ${jeton(cle, secret)}`,
        Accept: "application/json",
        "User-Agent": AGENT,
        ...(enJson ? { "Content-Type": "application/json" } : {}),
      },
      body: enJson ? JSON.stringify(corps) : corps,
    });
    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      throw new Error(`AMO ${reponse.status} sur ${methode} ${url}${detail.startsWith("{") ? ` : ${detail.slice(0, 500)}` : ""}`);
    }
    if (attendu === "rien") return null;
    if (attendu === "json") {
      const type = reponse.headers.get("content-type") ?? "";
      if (!type.includes("json")) throw new Error(`AMO a répondu ${type || "sans type"} au lieu de JSON sur ${url}`);
      return reponse.json();
    }
    return Buffer.from(await reponse.arrayBuffer());
  };

  return {
    /** La version `numero` de l'extension `id`, tous canaux, ou null. */
    async version(id, numero) {
      let page = new URL(`addons/addon/${encodeURIComponent(id)}/versions/?filter=all_with_unlisted&page_size=50`, API);
      while (page) {
        const { results, next } = await demander(page);
        const trouvee = results.find((v) => v.version === numero);
        if (trouvee) return trouvee;
        page = next ? new URL(next) : null;
      }
      return null;
    },

    /** Attend que la version quitte la relecture, au plus `delai` ms. */
    async attendre(id, numero, { delai, intervalle = 30_000, dormir = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
      const fin = Date.now() + delai;
      for (;;) {
        const version = await this.version(id, numero);
        if (version && etatDe(version) !== "en-relecture") return version;
        if (Date.now() + intervalle > fin) return version;
        await dormir(intervalle);
      }
    },

    /** Les captures de la fiche, dans leur ordre : `{ id, caption, position, image_url }`. */
    async captures(id) {
      const { previews } = await demander(new URL(`addons/addon/${encodeURIComponent(id)}/`, API));
      return previews ?? [];
    },

    /** Ajoute une capture, puis lui donne sa légende et sa place (l'API refuse les deux à l'envoi). */
    async ajouterCapture(id, { image, nom, legende, position }) {
      const formulaire = new FormData();
      formulaire.set("image", new Blob([image], { type: "image/png" }), nom);
      formulaire.set("position", String(position));
      const url = new URL(`addons/addon/${encodeURIComponent(id)}/previews/`, API);
      const { id: capture } = await demander(url, "json", { methode: "POST", corps: formulaire });
      return this.modifierCapture(id, capture, { legende, position });
    },

    async modifierCapture(id, capture, { legende, position }) {
      const url = new URL(`addons/addon/${encodeURIComponent(id)}/previews/${capture}/`, API);
      return demander(url, "json", { methode: "PATCH", corps: { caption: legende, position } });
    },

    /** Télécharge le fichier signé d'une version publiée. */
    async telecharger(version, destination) {
      if (etatDe(version) !== "publiee") throw new Error(`${version.version} n'est pas publiée`);
      await writeFile(destination, await demander(version.file.url, "binaire"));
    },
  };
}
