/**
 * Arrière-plan : le raccourci clavier et la pastille de l'icône.
 *
 * Page d'événements (MV3 sous Firefox) : endormie la plupart du temps, réveillée
 * par les écouteurs déclarés ici, au premier niveau.
 */
"use strict";

const { lire, ecrire, suivre } = globalThis.SansPrixReglages;
const t = (cle) => browser.i18n.getMessage(cle);

async function afficherEtat({ actif }) {
  await browser.action.setBadgeBackgroundColor({ color: "#4b5563" });
  await browser.action.setBadgeText({ text: actif ? "" : t("badgePause") });
  await browser.action.setTitle({ title: t(actif ? "titreActif" : "titrePause") });
}

browser.commands.onCommand.addListener(async (commande) => {
  if (commande !== "basculer") return;
  const { actif } = await lire();
  await ecrire({ actif: !actif });
});

suivre(afficherEtat);

const rafraichir = () => lire().then(afficherEtat, console.error);
browser.runtime.onStartup.addListener(rafraichir);
browser.runtime.onInstalled.addListener(rafraichir);
