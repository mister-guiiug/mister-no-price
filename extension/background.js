/**
 * Arrière-plan : le raccourci clavier, la pastille de l'icône et la page des
 * nouveautés.
 *
 * La pastille dit, dans l'ordre :
 *   « ! »   — un site attend l'accord de l'utilisateur (après une mise à jour
 *             qui l'a ajouté) : le popup propose de l'autoriser ;
 *   « off » — le masquage est coupé, ou en pause ;
 *   un nombre, onglet par onglet — les prix masqués sur la page, que chaque
 *             page compte et envoie (réglage `compteur`).
 *
 * À l'installation, et après une mise à jour qui ajoute des sites ou change de
 * version mineure, la page des nouveautés s'ouvre : ce qui change, les sites à
 * autoriser d'un clic, le code parent.
 *
 * Sous Firefox pour Android, ni raccourci ni barre d'outils : la pastille est
 * reprise dans le menu des extensions.
 *
 * Page d'événements (MV3 sous Firefox) : endormie la plupart du temps, réveillée
 * par les écouteurs déclarés ici, au premier niveau.
 */
"use strict";

const { lire, ecrire, suivre, enPause } = globalThis.SansPrixReglages;
const { accesManquants } = globalThis.SansPrixAcces;
const Code = globalThis.SansPrixCode;
const t = (cle, ...valeurs) => browser.i18n.getMessage(cle, valeurs);

const ALARME_PAUSE = "fin-de-pause";

async function afficherEtat(reglages) {
  const { noms } = await accesManquants();
  if (noms.length > 0) {
    await browser.action.setBadgeBackgroundColor({ color: "#b45309" });
    await browser.action.setBadgeText({ text: "!" });
    await browser.action.setTitle({ title: t("titreAcces") });
    return;
  }
  const pause = enPause(reglages);
  const actif = reglages.actif && !pause;
  await browser.action.setBadgeBackgroundColor({ color: "#4b5563" });
  await browser.action.setBadgeText({ text: actif ? "" : t("badgePause") });
  const heure = new Date(reglages.pauseJusqua).toLocaleTimeString(t("langue"), { hour: "2-digit", minute: "2-digit" });
  await browser.action.setTitle({
    title: !reglages.actif ? t("titrePause") : pause ? t("titrePauseJusqua", heure) : t("titreActif"),
  });
  // La pastille repasse d'elle-même à l'état actif à la fin de la pause.
  if (pause) browser.alarms?.create(ALARME_PAUSE, { when: reglages.pauseJusqua + 100 });
}

// Firefox pour Android n'a pas de raccourcis clavier : l'API `commands` y est
// absente, et l'appeler lèverait une erreur qui empêcherait tout ce qui suit
// (pastille, suivi des réglages) de s'enregistrer.
browser.commands?.onCommand.addListener(async (commande) => {
  if (commande !== "basculer") return;
  const reglages = await lire();
  const masque = reglages.actif && !enPause(reglages);
  // Couper le masquage dévoile les prix : avec un code parent, le raccourci
  // ouvre le popup, qui le demandera. Rallumer ne demande rien.
  if (masque && (await Code.estDefini())) {
    await browser.action.openPopup?.().catch(() => {});
    return;
  }
  await ecrire(masque ? { actif: false } : { actif: true, pauseJusqua: 0 });
});

// Le nombre de prix masqués d'un onglet, envoyé par masquage.js. Zéro rend
// l'onglet à la pastille commune (`null`).
browser.runtime.onMessage.addListener((message, expediteur) => {
  const onglet = expediteur.tab?.id;
  if (message?.type !== "compteur" || onglet == null) return;
  const n = Number(message.n) || 0;
  const texte = n > 0 ? (n > 99 ? "99+" : String(n)) : null;
  browser.action.setBadgeText({ tabId: onglet, text: texte }).catch(() => {});
  browser.action
    .setBadgeBackgroundColor({ tabId: onglet, color: texte ? "#7048e8" : null })
    .catch(() => {});
});

browser.alarms?.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME_PAUSE) rafraichir();
});

suivre(afficherEtat);

const rafraichir = () => lire().then(afficherEtat, console.error);

/** Version « majeure.mineure » : une version corrective n'ouvre pas la page. */
const mineure = (version = "") => version.split(".").slice(0, 2).join(".");

browser.runtime.onStartup.addListener(rafraichir);
browser.runtime.onInstalled.addListener(async ({ reason, previousVersion, temporary }) => {
  await rafraichir();
  // Un chargement temporaire (about:debugging, npm start, le vérificateur)
  // n'ouvre pas la page à chaque fois.
  if (temporary) return;
  const version = browser.runtime.getManifest().version;
  const nouvelle = reason === "install";
  const montee = reason === "update" && mineure(previousVersion) !== mineure(version);
  const aAutoriser = reason === "update" && (await accesManquants()).noms.length > 0;
  if (!nouvelle && !montee && !aAutoriser) return;
  const page = browser.runtime.getURL(`nouveautes/nouveautes.html?raison=${reason}`);
  await browser.tabs.create({ url: page }).catch(console.error);
});
// Accordé depuis le popup, ou retiré depuis le gestionnaire des extensions.
browser.permissions.onAdded.addListener(rafraichir);
browser.permissions.onRemoved.addListener(rafraichir);
