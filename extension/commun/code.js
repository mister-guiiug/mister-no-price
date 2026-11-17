/**
 * Le code parent : ce qui sépare « voir les prix » de « les cacher ».
 *
 * Défini, il est demandé pour tout ce qui DÉVOILE : couper le masquage, le
 * mettre en pause, l'éteindre sur un site, afficher les prix de la liste
 * d'envies, la vider, changer ou retirer le code. Rallumer, lui, ne demande
 * rien.
 *
 * Rangé dans storage.local, jamais en clair : un sel tiré au hasard et
 * l'empreinte SHA-256 du sel suivi du code. Ce n'est pas un coffre-fort — qui
 * ouvre about:addons peut désinstaller l'extension ; la stratégie
 * `force_installed` du paquet (policies.json) l'en empêche —, c'est une porte
 * fermée à un enfant curieux.
 *
 * Partagé par le popup, la page de la liste, la page des nouveautés et
 * l'arrière-plan (le raccourci clavier).
 */
(() => {
  "use strict";

  const CLE = "codeParent";
  /** De 4 à 8 chiffres : facile à taper au doigt, assez pour un enfant. */
  const FORME = /^\d{4,8}$/;

  const hex = (octets) => [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, "0")).join("");

  async function empreinte(sel, code) {
    return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sel}:${code}`)));
  }

  async function lireEnregistre() {
    const { [CLE]: valeur } = await browser.storage.local.get(CLE);
    return valeur && typeof valeur.sel === "string" && typeof valeur.empreinte === "string" ? valeur : null;
  }

  async function estDefini() {
    return (await lireEnregistre()) !== null;
  }

  const valide = (code) => typeof code === "string" && FORME.test(code);

  async function definir(code) {
    if (!valide(code)) throw new Error("Le code parent compte de 4 à 8 chiffres.");
    const sel = hex(crypto.getRandomValues(new Uint8Array(16)));
    await browser.storage.local.set({ [CLE]: { sel, empreinte: await empreinte(sel, code) } });
  }

  /** Vrai si le code est le bon — ou s'il n'y a pas de code. */
  async function verifier(code) {
    const enregistre = await lireEnregistre();
    if (!enregistre) return true;
    if (!valide(code)) return false;
    return (await empreinte(enregistre.sel, code)) === enregistre.empreinte;
  }

  async function retirer() {
    await browser.storage.local.remove(CLE);
  }

  /** Rappelle `rappel(defini)` quand le code est posé, changé ou retiré. */
  function suivre(rappel) {
    browser.storage.onChanged.addListener((changements, zone) => {
      if (zone === "local" && CLE in changements) estDefini().then(rappel, console.error);
    });
  }

  globalThis.SansPrixCode = Object.freeze({ FORME, valide, estDefini, definir, verifier, retirer, suivre });
})();
