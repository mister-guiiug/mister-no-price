/**
 * Les accès aux sites, que Firefox accorde ou non.
 *
 * Firefox accorde les accès d'une extension à son installation. Ceux qu'une
 * MISE À JOUR ajoute ne le sont pas d'office : une version qui gagne un site
 * (Dealabs, Fnac…) n'y tourne pas tant que l'utilisateur n'a pas dit oui. Il
 * peut cliquer sur l'icône, mais cet accès-là ne vaut que pour la page ouverte :
 * à la page suivante, les prix reviennent. D'où ce module : savoir ce qui
 * manque, et le demander une fois pour toutes.
 *
 * Partagé par le popup et l'arrière-plan ; s'appuie sur regles.js et moteur.js.
 */
(() => {
  "use strict";

  const { motifsDuManifeste } = globalThis.SansPrixMoteur;

  /**
   * Les sites dont Firefox n'a pas accordé l'accès : { motifs, noms }. Ceux du
   * catalogue appliqué — embarqué, ou distant s'il est plus récent : un site
   * que le catalogue distant ajoute se demande comme un site qu'une mise à
   * jour ajoute (permission optionnelle `*://*\/*` du manifeste).
   */
  async function accesManquants() {
    const { regles } = await globalThis.SansPrixCatalogue.lire();
    const manquantes = [];
    for (const regle of regles) {
      const motifs = motifsDuManifeste([regle]);
      if (!(await browser.permissions.contains({ origins: motifs }))) manquantes.push(regle);
    }
    return {
      motifs: motifsDuManifeste(manquantes),
      noms: manquantes.map((r) => r.nom),
    };
  }

  /**
   * Demande les accès donnés. À appeler DANS le gestionnaire d'un clic, sans
   * `await` avant : Firefox refuse une demande qui ne suit pas un geste de
   * l'utilisateur.
   */
  function demanderAcces(motifs) {
    return browser.permissions.request({ origins: motifs });
  }

  globalThis.SansPrixAcces = Object.freeze({ accesManquants, demanderAcces });
})();
