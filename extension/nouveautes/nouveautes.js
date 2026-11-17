/**
 * La page des nouveautés : ouverte par l'arrière-plan à l'installation, et
 * après une mise à jour qui ajoute des sites ou change de version mineure.
 *
 * Trois choses, dans l'ordre où elles comptent :
 *   1. les sites qu'une mise à jour a ajoutés n'ont pas d'accès tant que
 *      l'utilisateur n'a pas dit oui — un grand bouton, plutôt que la seule
 *      pastille « ! » de l'icône ;
 *   2. ce que la version change ;
 *   3. le code parent, à poser une fois pour toutes.
 */
(async () => {
  "use strict";

  const t = (cle, ...valeurs) => browser.i18n.getMessage(cle, valeurs);
  const $ = (id) => document.getElementById(id);
  const langue = t("langue");
  document.documentElement.lang = langue;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  const { version } = browser.runtime.getManifest();
  const installation = new URLSearchParams(location.search).get("raison") === "install";
  $("titre").textContent = installation ? t("nouveautesBienvenue") : t("nouveautesTitre", version);
  document.title = $("titre").textContent;

  // Les points de la version, séparés par « | » dans les traductions.
  $("points").replaceChildren(
    ...t("nouveautesPoints")
      .split("|")
      .map((point) => {
        const li = document.createElement("li");
        li.textContent = point.trim();
        return li;
      }),
  );

  // 1. Les accès.
  const { accesManquants, demanderAcces } = globalThis.SansPrixAcces;
  const liste = new Intl.ListFormat(langue, { type: "conjunction" });
  let manquants = await accesManquants();
  const montrerAcces = () => {
    const n = manquants.noms.length;
    $("acces").hidden = n === 0;
    $("acces-ok").hidden = n > 0 || installation;
    $("acces-titre").textContent = t("nouveautesAccesTitre", String(n));
    $("acces-noms").textContent = liste.format(
      [...manquants.noms].sort((a, b) => a.localeCompare(b, langue, { sensitivity: "base" })),
    );
  };
  montrerAcces();
  $("acces-bouton").addEventListener("click", () => {
    // Pas d'`await` avant la demande : Firefox exige qu'elle suive le clic.
    demanderAcces(manquants.motifs).then(async () => {
      manquants = await accesManquants();
      montrerAcces();
    }, console.error);
  });

  // 3. Le code parent.
  const Code = globalThis.SansPrixCode;
  const zone = $("code");
  const montrerCode = async () => {
    if (await Code.estDefini()) {
      const p = document.createElement("p");
      p.className = "code-pose";
      p.textContent = t("codeDejaDefini");
      zone.replaceChildren(p);
    } else {
      zone.replaceChildren(globalThis.SansPrixCodeUI.formulaireNouveauCode(montrerCode));
    }
  };
  await montrerCode();
})();
