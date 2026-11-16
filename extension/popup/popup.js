(async () => {
  "use strict";

  const { lire, ecrire } = globalThis.SansPrixReglages;
  const t = (cle, ...valeurs) => browser.i18n.getMessage(cle, valeurs);

  document.documentElement.lang = t("langue");
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  // La liste des sites vient des règles : un site ajouté y apparaît sans retouche.
  const sites = globalThis.SansPrixRegles.map((r) => r.nom).sort((a, b) =>
    a.localeCompare(b, t("langue"), { sensitivity: "base" }),
  );
  document.getElementById("sites").textContent = t(
    "popupSites",
    new Intl.ListFormat(t("langue"), { type: "conjunction" }).format(sites),
  );

  // Les sites qu'une mise à jour a ajoutés n'ont pas d'accès tant que
  // l'utilisateur n'a pas dit oui : on le signale, et on le demande d'un clic.
  const { accesManquants, demanderAcces } = globalThis.SansPrixAcces;
  const listeDe = (noms) =>
    new Intl.ListFormat(t("langue"), { type: "conjunction" }).format(
      [...noms].sort((a, b) => a.localeCompare(b, t("langue"), { sensitivity: "base" })),
    );
  const encart = document.getElementById("acces");
  let manquants = await accesManquants();
  const montrerAcces = () => {
    encart.hidden = manquants.noms.length === 0;
    document.getElementById("acces-texte").textContent = t("accesManquant", listeDe(manquants.noms));
  };
  montrerAcces();
  document.getElementById("acces-bouton").addEventListener("click", () => {
    // Pas d'`await` avant la demande : Firefox exige qu'elle suive le clic.
    demanderAcces(manquants.motifs).then(async () => {
      manquants = await accesManquants();
      montrerAcces();
    }, console.error);
  });

  const actif = document.getElementById("actif");
  const styles = document.querySelectorAll('input[name="style"]');

  const reglages = await lire();
  actif.checked = reglages.actif;
  for (const choix of styles) choix.checked = choix.value === reglages.style;

  actif.addEventListener("change", () => ecrire({ actif: actif.checked }));

  // La liste d'envies : le bouton ♥ des fiches, et la page de la liste.
  const enviesBouton = document.getElementById("envies-bouton");
  enviesBouton.checked = reglages.envies;
  enviesBouton.addEventListener("change", () => ecrire({ envies: enviesBouton.checked }));
  const ouvrir = document.getElementById("envies-ouvrir");
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
  for (const choix of styles) {
    choix.addEventListener("change", () => {
      if (choix.checked) ecrire({ style: choix.value });
    });
  }

  // Le raccourci affiché est celui que l'utilisateur a pu redéfinir, pas celui du
  // manifeste. Firefox pour Android n'a pas de raccourcis : rien à afficher.
  if (!browser.commands) return;
  const commandes = await browser.commands.getAll();
  const raccourci = commandes.find((c) => c.name === "basculer")?.shortcut;
  if (raccourci) document.getElementById("raccourci").textContent = t("popupRaccourci", raccourci);
})();
