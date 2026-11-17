/**
 * La boîte qui demande le code parent, commune au popup, à la liste d'envies et
 * à la page des nouveautés. Construite à la demande, en `<dialog>` modal.
 *
 *   if (!(await SansPrixCodeUI.exiger())) return; // annulé ou mauvais code
 *
 * Sans code défini, `exiger()` répond oui sans rien montrer.
 */
(() => {
  "use strict";

  const Code = globalThis.SansPrixCode;
  const t = (cle, ...valeurs) => browser.i18n.getMessage(cle, valeurs);

  let boite = null;

  /** Un élément, ses attributs et ses enfants. */
  function el(nom, attributs = {}, ...enfants) {
    const e = document.createElement(nom);
    for (const [cle, valeur] of Object.entries(attributs)) e.setAttribute(cle, valeur);
    e.append(...enfants);
    return e;
  }

  function construire() {
    boite = el(
      "dialog",
      { class: "code-dialogue" },
      el(
        "form",
        { method: "dialog" },
        el(
          "label",
          {},
          el("span", { class: "code-libelle" }, t("codeDemande")),
          el("input", {
            type: "password",
            inputmode: "numeric",
            autocomplete: "off",
            maxlength: "8",
            pattern: "[0-9]{4,8}",
            required: "",
          }),
        ),
        el("p", { class: "code-erreur", role: "alert" }),
        el(
          "div",
          { class: "code-boutons" },
          el("button", { type: "button", class: "code-annuler" }, t("codeAnnuler")),
          el("button", { type: "submit", class: "code-valider" }, t("codeValider")),
        ),
      ),
    );
    document.body.append(boite);
  }

  /** Demande le code ; vrai s'il est bon (ou s'il n'y en a pas). */
  async function exiger() {
    if (!(await Code.estDefini())) return true;
    if (!boite) construire();
    const champ = boite.querySelector("input");
    const erreur = boite.querySelector(".code-erreur");
    const formulaire = boite.querySelector("form");
    champ.value = "";
    erreur.textContent = "";

    return new Promise((resoudre) => {
      const fermer = (resultat) => {
        formulaire.removeEventListener("submit", valider);
        annuler.removeEventListener("click", surAnnuler);
        boite.removeEventListener("cancel", surAnnuler);
        boite.close();
        resoudre(resultat);
      };
      const valider = async (evenement) => {
        evenement.preventDefault();
        if (await Code.verifier(champ.value)) {
          fermer(true);
        } else {
          erreur.textContent = t("codeFaux");
          champ.select();
        }
      };
      const surAnnuler = (evenement) => {
        evenement.preventDefault();
        fermer(false);
      };
      const annuler = boite.querySelector(".code-annuler");
      formulaire.addEventListener("submit", valider);
      annuler.addEventListener("click", surAnnuler);
      boite.addEventListener("cancel", surAnnuler);
      boite.showModal();
      champ.focus();
    });
  }

  /**
   * Le formulaire qui pose (ou change) le code : le code, deux fois. Rend un
   * <form> ; `apres()` est rappelée une fois le code enregistré.
   */
  function formulaireNouveauCode(apres = () => {}) {
    const champ = (libelle) =>
      el(
        "label",
        { class: "code-champ" },
        el("span", {}, t(libelle)),
        el("input", {
          type: "password",
          inputmode: "numeric",
          autocomplete: "new-password",
          maxlength: "8",
          pattern: "[0-9]{4,8}",
          required: "",
        }),
      );
    const premier = champ("codeNouveau");
    const second = champ("codeConfirmer");
    const erreur = el("p", { class: "code-erreur", role: "alert" });
    const formulaire = el(
      "form",
      { class: "code-formulaire" },
      premier,
      second,
      erreur,
      el("button", { type: "submit", class: "code-definir" }, t("codeDefinir")),
    );
    formulaire.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const [a, b] = [premier, second].map((l) => l.querySelector("input").value);
      if (!Code.valide(a)) erreur.textContent = t("codeForme");
      else if (a !== b) erreur.textContent = t("codeDifferents");
      else {
        await Code.definir(a);
        formulaire.reset();
        erreur.textContent = "";
        apres();
      }
    });
    return formulaire;
  }

  globalThis.SansPrixCodeUI = Object.freeze({ exiger, formulaireNouveauCode });
})();
