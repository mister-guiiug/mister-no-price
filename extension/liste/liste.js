/**
 * La page de la liste d'envies, pour le parent.
 *
 * Les prix y sont masqués à l'ouverture, comme partout : l'enfant peut ouvrir
 * cette page sans tout dévoiler. « Afficher les prix » les montre, avec le
 * total par devise, le temps de la visite — rien n'est retenu. Le partage
 * reprend ce qui est à l'écran : sans les prix tant qu'ils sont masqués.
 */
(() => {
  "use strict";

  const Envies = globalThis.SansPrixEnvies;
  const t = (cle, ...valeurs) => browser.i18n.getMessage(cle, valeurs);
  const langue = t("langue");

  document.documentElement.lang = langue;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  const $ = (id) => document.getElementById(id);
  const boutonPrix = $("prix");
  let prixVisibles = false;
  let articles = [];

  const formatDate = new Intl.DateTimeFormat(langue, { day: "numeric", month: "short" });

  function formatPrix(prix, devise) {
    if (prix == null) return null;
    try {
      if (devise) return new Intl.NumberFormat(langue, { style: "currency", currency: devise }).format(prix);
    } catch {
      // Un code de devise que le navigateur ne connaît pas : le nombre seul.
    }
    return new Intl.NumberFormat(langue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(prix);
  }

  /** Un total par devise : on n'additionne pas des euros et des dollars. */
  function totaux(liste) {
    const parDevise = new Map();
    for (const { prix, devise } of liste) {
      if (prix == null) continue;
      parDevise.set(devise ?? "", (parDevise.get(devise ?? "") ?? 0) + prix);
    }
    return [...parDevise].map(([devise, somme]) => formatPrix(somme, devise || null));
  }

  function article(a) {
    const li = document.createElement("li");
    li.className = "article";

    if (a.image) {
      const img = document.createElement("img");
      img.src = a.image;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.className = "vignette";
      img.addEventListener("error", () => img.replaceWith(vignetteVide()), { once: true });
      li.append(img);
    } else {
      li.append(vignetteVide());
    }

    const infos = document.createElement("div");
    infos.className = "infos";
    const lien = document.createElement("a");
    lien.href = a.url;
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    lien.className = "titre";
    lien.textContent = a.titre;
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [a.site, a.ajoute ? formatDate.format(a.ajoute) : null].filter(Boolean).join(" · ");
    const prix = document.createElement("p");
    prix.className = "prix";
    const montant = formatPrix(a.prix, a.devise);
    if (!prixVisibles) {
      prix.classList.add("masque");
      prix.textContent = "00,00 €";
      prix.setAttribute("aria-label", t("listePrixMasque"));
    } else {
      prix.textContent = montant ?? t("listePrixInconnu");
      if (!montant) prix.classList.add("inconnu");
    }
    infos.append(lien, meta, prix);

    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "retirer";
    retirer.textContent = t("listeRetirer");
    retirer.setAttribute("aria-label", t("listeRetirerArticle", a.titre));
    retirer.addEventListener("click", () => Envies.retirer(a.url).catch(console.error));

    li.append(infos, retirer);
    return li;
  }

  function vignetteVide() {
    const span = document.createElement("span");
    span.className = "vignette vignette-vide";
    span.setAttribute("aria-hidden", "true");
    span.textContent = "♥";
    return span;
  }

  function afficher() {
    $("articles").replaceChildren(...articles.map(article));
    $("compte").textContent = t(articles.length > 1 ? "listeCompteN" : "listeCompte1", String(articles.length));
    $("vide").hidden = articles.length > 0;
    for (const id of ["prix", "partager", "vider"]) $(id).disabled = articles.length === 0;

    boutonPrix.setAttribute("aria-pressed", String(prixVisibles));
    boutonPrix.textContent = t(prixVisibles ? "listeMasquerPrix" : "listeMontrerPrix");
    const sommes = totaux(articles);
    $("total").hidden = !prixVisibles || sommes.length === 0;
    $("total").textContent = t("listeTotal", sommes.join(" + "));
  }

  function texteAPartager() {
    const lignes = articles.map((a) => {
      const prix = prixVisibles ? formatPrix(a.prix, a.devise) : null;
      const details = [prix, a.site].filter(Boolean).join(", ");
      return `• ${a.titre}${details ? ` (${details})` : ""}\n  ${a.url}`;
    });
    return `${t("listeTitre")}\n\n${lignes.join("\n")}\n`;
  }

  boutonPrix.addEventListener("click", () => {
    prixVisibles = !prixVisibles;
    afficher();
  });

  $("partager").addEventListener("click", async () => {
    const texte = texteAPartager();
    // Le partage du système (Firefox pour Android) ; sinon le presse-papiers.
    if (navigator.share) {
      try {
        await navigator.share({ title: t("listeTitre"), text: texte });
        return;
      } catch (erreur) {
        if (erreur.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(texte);
      $("message").textContent = t("listeCopiee");
    } catch {
      $("message").textContent = t("listeCopieImpossible");
    }
  });

  $("vider").addEventListener("click", () => {
    if (window.confirm(t("listeViderConfirmer"))) Envies.vider().catch(console.error);
  });

  const recharger = (liste) => {
    articles = liste;
    afficher();
  };
  Envies.lire().then(recharger, console.error);
  Envies.suivre(recharger);
})();
