/**
 * Arrière-plan : le raccourci clavier et la pastille de l'icône.
 *
 * La pastille dit, dans l'ordre :
 *   « ! » — un site attend l'accord de l'utilisateur (après une mise à jour qui
 *           l'a ajouté) : le popup propose de l'autoriser ;
 *   « off » — le masquage est suspendu.
 *
 * Sous Firefox pour Android, ni raccourci ni barre d'outils : la pastille est
 * reprise dans le menu des extensions.
 *
 * Page d'événements (MV3 sous Firefox) : endormie la plupart du temps, réveillée
 * par les écouteurs déclarés ici, au premier niveau.
 */
"use strict";

const { lire, ecrire, suivre } = globalThis.SansPrixReglages;
const { accesManquants } = globalThis.SansPrixAcces;
const t = (cle) => browser.i18n.getMessage(cle);

async function afficherEtat({ actif }) {
  const { noms } = await accesManquants();
  if (noms.length > 0) {
    await browser.action.setBadgeBackgroundColor({ color: "#b45309" });
    await browser.action.setBadgeText({ text: "!" });
    await browser.action.setTitle({ title: t("titreAcces") });
    return;
  }
  await browser.action.setBadgeBackgroundColor({ color: "#4b5563" });
  await browser.action.setBadgeText({ text: actif ? "" : t("badgePause") });
  await browser.action.setTitle({ title: t(actif ? "titreActif" : "titrePause") });
}

// Firefox pour Android n'a pas de raccourcis clavier : l'API `commands` y est
// absente, et l'appeler lèverait une erreur qui empêcherait tout ce qui suit
// (pastille, suivi des réglages) de s'enregistrer.
browser.commands?.onCommand.addListener(async (commande) => {
  if (commande !== "basculer") return;
  const { actif } = await lire();
  await ecrire({ actif: !actif });
});

suivre(afficherEtat);

const rafraichir = () => lire().then(afficherEtat, console.error);
browser.runtime.onStartup.addListener(rafraichir);
browser.runtime.onInstalled.addListener(rafraichir);
// Accordé depuis le popup, ou retiré depuis le gestionnaire des extensions.
browser.permissions.onAdded.addListener(rafraichir);
browser.permissions.onRemoved.addListener(rafraichir);
