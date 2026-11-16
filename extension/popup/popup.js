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

  const actif = document.getElementById("actif");
  const styles = document.querySelectorAll('input[name="style"]');

  const reglages = await lire();
  actif.checked = reglages.actif;
  for (const choix of styles) choix.checked = choix.value === reglages.style;

  actif.addEventListener("change", () => ecrire({ actif: actif.checked }));
  for (const choix of styles) {
    choix.addEventListener("change", () => {
      if (choix.checked) ecrire({ style: choix.value });
    });
  }

  // Le raccourci affiché est celui que l'utilisateur a pu redéfinir, pas celui du manifeste.
  const commandes = await browser.commands.getAll();
  const raccourci = commandes.find((c) => c.name === "basculer")?.shortcut;
  if (raccourci) document.getElementById("raccourci").textContent = t("popupRaccourci", raccourci);
})();
