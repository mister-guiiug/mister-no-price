(async () => {
  "use strict";

  const { lire, ecrire, suivre, enPause } = globalThis.SansPrixReglages;
  const { trouverRegle } = globalThis.SansPrixMoteur;
  const REGLES = globalThis.SansPrixRegles;
  const Code = globalThis.SansPrixCode;
  const { exiger, formulaireNouveauCode } = globalThis.SansPrixCodeUI;
  const t = (cle, ...valeurs) => browser.i18n.getMessage(cle, valeurs);
  const $ = (id) => document.getElementById(id);
  const langue = t("langue");

  document.documentElement.lang = langue;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  const parNom = (a, b) => a.localeCompare(b, langue, { sensitivity: "base" });
  const listeDe = (noms) => new Intl.ListFormat(langue, { type: "conjunction" }).format([...noms].sort(parNom));

  let reglages = await lire();

  // --- Les accès qu'une mise à jour a ajoutés ------------------------------------

  // Les sites qu'une mise à jour a ajoutés n'ont pas d'accès tant que
  // l'utilisateur n'a pas dit oui : on le signale, et on le demande d'un clic.
  // Au-delà de quelques noms, le message donne leur nombre et la liste se
  // déplie à la demande.
  const { accesManquants, demanderAcces } = globalThis.SansPrixAcces;
  const NOMS_EN_CLAIR = 4;
  let manquants = await accesManquants();
  const montrerAcces = () => {
    const { noms } = manquants;
    $("acces").hidden = noms.length === 0;
    const enClair = noms.length <= NOMS_EN_CLAIR;
    $("acces-texte").textContent = enClair
      ? t("accesManquant", listeDe(noms))
      : t("accesManquantNombre", String(noms.length));
    $("acces-detail").hidden = enClair;
    $("acces-noms").textContent = listeDe(noms);
  };
  montrerAcces();
  $("acces-bouton").addEventListener("click", () => {
    // Pas d'`await` avant la demande : Firefox exige qu'elle suive le clic.
    demanderAcces(manquants.motifs).then(async () => {
      manquants = await accesManquants();
      montrerAcces();
    }, console.error);
  });

  // --- L'interrupteur général et celui du site ouvert ----------------------------

  // Tout ce qui DÉVOILE les prix passe par le code parent, s'il y en a un ;
  // ce qui les cache, jamais. Un refus remet la case comme elle était.
  const actif = $("actif");
  actif.addEventListener("change", async () => {
    if (actif.checked) return ecrire({ actif: true, pauseJusqua: 0 });
    if (await exiger()) return ecrire({ actif: false });
    actif.checked = true;
  });

  // L'onglet ouvert : son adresse n'est lisible que sur un site des règles,
  // dont l'extension a l'accès — ailleurs, la ligne reste cachée.
  const [onglet] = await browser.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  let regleIci = null;
  try {
    regleIci = onglet?.url ? trouverRegle(new URL(onglet.url).hostname, REGLES) : null;
  } catch {
    regleIci = null;
  }
  const site = $("site");
  if (regleIci) {
    $("ce-site").hidden = false;
    $("ce-site-nom").textContent = t("popupCeSite", regleIci.nom);
    site.addEventListener("change", () => basculerSite(regleIci.id, site.checked, site));
  }

  /** Allume ou éteint un site ; l'éteindre demande le code. */
  async function basculerSite(id, masquer, caseACocher) {
    const eteints = new Set(reglages.sitesEteints);
    if (!masquer && !(await exiger())) {
      caseACocher.checked = true;
      return;
    }
    if (masquer) eteints.delete(id);
    else eteints.add(id);
    await ecrire({ sitesEteints: [...eteints] });
  }

  // --- La pause minutée ------------------------------------------------------------

  const heure = new Intl.DateTimeFormat(langue, { hour: "2-digit", minute: "2-digit" });
  for (const bouton of document.querySelectorAll("[data-minutes]")) {
    bouton.addEventListener("click", async () => {
      if (!(await exiger())) return;
      await ecrire({ pauseJusqua: Date.now() + Number(bouton.dataset.minutes) * 60_000 });
    });
  }
  $("reprendre").addEventListener("click", () => ecrire({ pauseJusqua: 0 }));
  // Le popup peut rester ouvert pendant que la pause se termine.
  setInterval(() => rendre(), 15_000);

  // --- Apparence, liste d'envies, compteur -------------------------------------------

  const styles = document.querySelectorAll('input[name="style"]');
  for (const choix of styles) {
    choix.addEventListener("change", () => {
      if (choix.checked) ecrire({ style: choix.value });
    });
  }

  const enviesBouton = $("envies-bouton");
  enviesBouton.addEventListener("change", () => ecrire({ envies: enviesBouton.checked }));
  const ouvrir = $("envies-ouvrir");
  const compter = (liste) => {
    ouvrir.textContent = t("popupEnviesOuvrir", String(liste.length));
  };
  const { lire: lireEnvies, suivre: suivreEnvies } = globalThis.SansPrixEnvies;
  compter(await lireEnvies());
  suivreEnvies(compter);
  ouvrir.addEventListener("click", async () => {
    await browser.tabs.create({ url: browser.runtime.getURL("liste/liste.html") });
    window.close();
  });

  const compteur = $("compteur");
  compteur.addEventListener("change", () => ecrire({ compteur: compteur.checked }));

  // --- Le code parent ----------------------------------------------------------------

  async function rendreCode() {
    const defini = await Code.estDefini();
    $("code-etat").textContent = t(defini ? "codeEtatDefini" : "codeEtatAucun");
    const zone = $("code-zone");
    if (!defini) {
      zone.replaceChildren(formulaireNouveauCode(rendreCode));
      return;
    }
    const changer = document.createElement("button");
    changer.type = "button";
    changer.textContent = t("codeChanger");
    changer.addEventListener("click", async () => {
      if (!(await exiger())) return;
      zone.replaceChildren(formulaireNouveauCode(rendreCode));
    });
    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.textContent = t("codeRetirer");
    retirer.addEventListener("click", async () => {
      if (!(await exiger())) return;
      await Code.retirer();
      await rendreCode();
    });
    const boutons = document.createElement("div");
    boutons.className = "code-actions";
    boutons.append(changer, retirer);
    zone.replaceChildren(boutons);
  }
  await rendreCode();

  // --- Les sites, un par un ------------------------------------------------------------

  // La liste vient des règles : un site ajouté y apparaît sans retouche.
  // Repliée derrière leur nombre : une quarantaine de noms rempliraient le popup.
  $("sites-nombre").textContent = t("popupSitesNombre", String(REGLES.length));
  const casesSites = new Map();
  $("sites").replaceChildren(
    ...[...REGLES]
      .sort((a, b) => parNom(a.nom, b.nom))
      .map((regle) => {
        const caseACocher = document.createElement("input");
        caseACocher.type = "checkbox";
        caseACocher.addEventListener("change", () => basculerSite(regle.id, caseACocher.checked, caseACocher));
        casesSites.set(regle.id, caseACocher);
        const label = document.createElement("label");
        label.append(caseACocher, ` ${regle.nom}`);
        const li = document.createElement("li");
        li.append(label);
        return li;
      }),
  );

  // --- L'état affiché, tenu à jour ------------------------------------------------------

  function rendre() {
    const pause = enPause(reglages);
    actif.checked = reglages.actif;
    for (const choix of styles) choix.checked = choix.value === reglages.style;
    enviesBouton.checked = reglages.envies;
    compteur.checked = reglages.compteur;
    if (regleIci) site.checked = !reglages.sitesEteints.includes(regleIci.id);
    for (const [id, caseACocher] of casesSites) caseACocher.checked = !reglages.sitesEteints.includes(id);

    $("pause-etat").hidden = !pause;
    $("pause-etat").textContent = pause ? t("pauseJusqua", heure.format(reglages.pauseJusqua)) : "";
    $("reprendre").hidden = !pause;
    for (const bouton of document.querySelectorAll("[data-minutes]")) bouton.disabled = !reglages.actif;
  }
  rendre();
  suivre((nouveaux) => {
    reglages = nouveaux;
    rendre();
  });
  Code.suivre(() => rendreCode().catch(console.error));

  // Le raccourci affiché est celui que l'utilisateur a pu redéfinir, pas celui du
  // manifeste. Firefox pour Android n'a pas de raccourcis : rien à afficher.
  if (!browser.commands) return;
  const commandes = await browser.commands.getAll();
  const raccourci = commandes.find((c) => c.name === "basculer")?.shortcut;
  if (raccourci) $("raccourci").textContent = t("popupRaccourci", raccourci);
})();
