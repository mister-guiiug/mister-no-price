#!/usr/bin/env node
/**
 * Vérifie l'extension sur le vrai site, dans le Firefox installé sur le poste.
 *
 *   npm run verifier                     # amazon.fr, sans fenêtre
 *   VISIBLE=1 npm run verifier           # avec la fenêtre
 *   BOUTIQUE=https://www.amazon.de npm run verifier
 *   FIREFOX="C:/…/firefox.exe" npm run verifier
 *
 * Pour chaque page (recherche, meilleures ventes, fiche produit), il relève les
 * montants encore LISIBLES : ni sous une barre, ni floutés, ni hors écran. Amazon
 * change son balisage sans prévenir — c'est ce relevé qui le dira. Il essaie
 * ensuite le popup (interrupteur, apparence) et laisse des captures dans
 * captures/.
 *
 * Si Amazon répond par une vérification anti-robot, le script s'arrête : il ne
 * la contourne pas. La relancer avec VISIBLE=1 permet de la passer soi-même.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const RACINE = resolve(import.meta.dirname, "..");
const EXTENSION = resolve(RACINE, "extension");
const CAPTURES = resolve(RACINE, "captures");
const BOUTIQUE = process.env.BOUTIQUE ?? "https://www.amazon.fr";
const RECHERCHE = process.env.RECHERCHE ?? "casque audio";

const ID_EXTENSION = JSON.parse(readFileSync(resolve(EXTENSION, "manifest.json"), "utf8"))
  .browser_specific_settings.gecko.id;
const DETECTION = readFileSync(resolve(EXTENSION, "content/detection.js"), "utf8");

function trouverFirefox() {
  const candidats = [
    process.env.FIREFOX,
    "C:/Program Files/Mozilla Firefox/firefox.exe",
    "C:/Program Files (x86)/Mozilla Firefox/firefox.exe",
    "/Applications/Firefox.app/Contents/MacOS/firefox",
    "/usr/bin/firefox",
    "/snap/bin/firefox",
  ].filter(Boolean);
  const trouve = candidats.find((chemin) => existsSync(chemin));
  if (!trouve) throw new Error("Firefox introuvable : indiquer son chemin dans FIREFOX.");
  return trouve;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function preparer(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  const robot = await page.evaluate(
    () =>
      Boolean(document.querySelector('form[action*="validateCaptcha"], #captchacharacters')) ||
      /robot/i.test(document.title),
  );
  if (robot) {
    throw new Error(
      `Amazon demande une vérification anti-robot sur ${url}. ` +
        "Le script ne la contourne pas : relancer avec VISIBLE=1 et la passer soi-même.",
    );
  }
  // Bandeau des cookies : on refuse ce qui n'est pas nécessaire.
  const refus = await page.$("#sp-cc-rejectall-link");
  if (refus) {
    await refus.click();
    await attendre(500);
  }
  // Laisse aux carrousels et aux blocs différés le temps d'arriver.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await attendre(1_500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await attendre(1_000);
}

/** Relève, dans la page, les montants qu'un œil lirait encore. */
async function releverMontantsVisibles(page) {
  await page.evaluate(DETECTION);
  return page.evaluate(() => {
    const { trouverMontants } = globalThis.SansPrixDetection;
    const surlignage = CSS.highlights.get("sans-prix");
    const plages = surlignage ? [...surlignage] : [];
    const largeurPage = document.documentElement.scrollWidth;

    const floute = (element) => {
      for (let e = element; e; e = e.parentElement) {
        if (getComputedStyle(e).filter.includes("blur")) return true;
      }
      return false;
    };
    const lisible = (element) => {
      const style = getComputedStyle(element);
      if (style.visibility !== "visible" || style.color === "rgba(0, 0, 0, 0)") return false;
      return !floute(element);
    };
    const aLEcran = (rects) =>
      [...rects].some((r) => r.width > 1 && r.height > 1 && r.right > 0 && r.left < largeurPage);
    const chemin = (element) => {
      const parts = [];
      for (let e = element; e && parts.length < 4; e = e.parentElement) {
        const classes = [...e.classList].slice(0, 2).join(".");
        parts.unshift(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : "") + (classes ? `.${classes}` : ""));
      }
      return parts.join(" > ");
    };

    // Un morceau de prix : des chiffres ou une devise, mais pas une remise « -21 % ».
    const EST_MORCEAU = /^(?!\s*-?\d+\s*%\s*$).*[\d€$£¥￥₹]/s;
    const restes = [];

    // 1. Montants d'un seul tenant dans un nœud texte : le repérage doit les couvrir.
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let total = 0;
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const parent = n.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(parent.nodeName)) continue;
      for (const { debut, fin } of trouverMontants(n.data)) {
        total += 1;
        const couvert = plages.some(
          (p) => p.startContainer === n && p.startOffset <= debut && p.endOffset >= fin,
        );
        if (couvert || !lisible(parent)) continue;
        const r = document.createRange();
        r.setStart(n, debut);
        r.setEnd(n, fin);
        if (!aLEcran(r.getClientRects())) continue;
        restes.push({ texte: n.data.slice(debut, fin), ou: chemin(parent) });
      }
    }

    // 2. Montants éclatés sur plusieurs nœuds (« 12 » « , » « 99 » « € ») : la regex
    //    ne les voit pas, seule la feuille peut les couvrir. On cherche les petits
    //    éléments dont le texte entier est un montant sans qu'aucun de leurs nœuds
    //    n'en porte un entier — la copie .a-offscreen des lecteurs d'écran mise à
    //    part. Puis on regarde si un morceau chiffré reste lisible ; le libellé
    //    « Conseillé : », lui, peut l'être.
    const textes = (e) => {
      const liste = [];
      const m = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let t = m.nextNode(); t; t = m.nextNode()) liste.push(t);
      return liste;
    };
    const signales = new Set();
    for (const e of document.body.querySelectorAll("span, div, td, a, b, strong, p")) {
      const texte = e.textContent.trim();
      if (texte.length === 0 || texte.length > 30 || e.children.length === 0) continue;
      if (trouverMontants(texte).length === 0) continue;
      const noeuds = textes(e).filter((t) => !t.parentElement.closest(".a-offscreen"));
      if (noeuds.some((t) => trouverMontants(t.data).length > 0)) continue;
      const lisibles = noeuds.filter(
        (t) =>
          EST_MORCEAU.test(t.data) &&
          lisible(t.parentElement) &&
          aLEcran(t.parentElement.getClientRects()),
      );
      // Un morceau remonte par chacun de ses ancêtres : on ne le signale qu'une fois.
      if (lisibles.length === 0 || lisibles.some((t) => signales.has(t))) continue;
      for (const t of lisibles) signales.add(t);
      restes.push({
        texte,
        ou: chemin(e),
        eclate: true,
        lisibles: lisibles.map((t) => `« ${t.data.trim()} » dans ${chemin(t.parentElement)}`),
      });
    }

    return {
      surlignage: Boolean(surlignage),
      plages: plages.length,
      masquesParFeuille: document.querySelectorAll(".a-price, .a-text-price").length,
      montantsTexte: total,
      restes,
    };
  });
}

/**
 * Ouvre le popup dans un onglet. WebDriver BiDi refuse de naviguer vers une
 * adresse moz-extension:// ; on passe par la fenêtre de Firefox elle-même, ce
 * que MOZ_REMOTE_ALLOW_SYSTEM_ACCESS autorise sur ce profil jetable.
 */
async function ouvrirPopup(navigateur) {
  const dejaOuvertes = new Set(await navigateur.pages());
  const { result } = await navigateur.connection.send("browsingContext.getTree", {
    "moz:scope": "chrome",
  });
  await navigateur.connection.send("script.evaluate", {
    target: { context: result.contexts[0].context },
    awaitPromise: false,
    expression: `gBrowser.addTab(
      WebExtensionPolicy.getByID(${JSON.stringify(ID_EXTENSION)}).getURL("popup/popup.html"),
      { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() },
    ) && true`,
  });
  for (let essai = 0; essai < 20; essai += 1) {
    await attendre(250);
    const nouvelle = (await navigateur.pages()).find((p) => !dejaOuvertes.has(p));
    if (nouvelle) {
      await attendre(500);
      return nouvelle;
    }
  }
  throw new Error("Le popup ne s'est pas ouvert.");
}

async function etatPage(page) {
  return page.evaluate(() => ({
    actif: document.documentElement.getAttribute("data-sans-prix"),
    style: document.documentElement.getAttribute("data-sans-prix-style"),
    surlignage: CSS.highlights.has("sans-prix"),
  }));
}

mkdirSync(CAPTURES, { recursive: true });
const navigateur = await puppeteer.launch({
  browser: "firefox",
  executablePath: trouverFirefox(),
  headless: !process.env.VISIBLE,
  defaultViewport: { width: 1366, height: 900 },
  env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" },
  extraPrefsFirefox: { "intl.accept_languages": "fr-FR, fr" },
});

let echec = false;
try {
  await navigateur.installExtension(EXTENSION);
  const page = await navigateur.newPage();

  const recherche = `${BOUTIQUE}/s?k=${encodeURIComponent(RECHERCHE)}`;
  await preparer(page, recherche);
  const lienProduit = await page.evaluate(
    () =>
      document.querySelector('[data-component-type="s-search-result"] a[href*="/dp/"]')?.href ?? null,
  );

  const pages = [
    ["recherche", recherche],
    ["meilleures-ventes", `${BOUTIQUE}/gp/bestsellers`],
    ...(lienProduit ? [["fiche-produit", lienProduit]] : []),
  ];

  for (const [nom, url] of pages) {
    if (url !== recherche) await preparer(page, url);
    const releve = await releverMontantsVisibles(page);
    await page.screenshot({ path: resolve(CAPTURES, `${nom}.png`) });
    console.log(
      `\n${nom} — surlignage ${releve.surlignage ? "posé" : "ABSENT"}, ` +
        `${releve.plages} plage(s), ${releve.masquesParFeuille} bloc(s) prix sous la feuille, ` +
        `${releve.montantsTexte} montant(s) dans le texte`,
    );
    if (!releve.surlignage) echec = true;
    if (releve.restes.length === 0) {
      console.log("  ✔ aucun montant lisible");
    } else {
      echec = true;
      for (const r of releve.restes.slice(0, 25)) {
        console.log(`  ✘ « ${r.texte} »${r.eclate ? " (éclaté)" : ""}  ←  ${r.ou}`);
        for (const l of r.lisibles ?? []) console.log(`      lisible : ${l}`);
      }
      if (releve.restes.length > 25) console.log(`  … et ${releve.restes.length - 25} autres`);
    }
  }

  // Le popup, ouvert comme une page : l'interrupteur et l'apparence agissent en direct.
  // Un onglet d'extension ne se redimensionne pas par BiDi : on capture son <main>.
  const popup = await ouvrirPopup(navigateur);
  await (await popup.$("main")).screenshot({ path: resolve(CAPTURES, "popup.png") });

  await page.bringToFront();
  console.log("\npopup");
  console.log("  au départ   ", await etatPage(page));
  await popup.click('input[name="style"][value="flou"]');
  await attendre(500);
  console.log("  flou        ", await etatPage(page));
  await page.screenshot({ path: resolve(CAPTURES, "fiche-produit-flou.png") });
  await popup.click("#actif");
  await attendre(500);
  const pause = await etatPage(page);
  console.log("  en pause    ", pause);
  await page.screenshot({ path: resolve(CAPTURES, "fiche-produit-pause.png") });
  if (pause.actif !== "off" || pause.surlignage) echec = true;
  // Remet les réglages par défaut (le profil est jetable, mais autant finir propre).
  await popup.click("#actif");
  await popup.click('input[name="style"][value="barre"]');

  console.log(`\nCaptures : ${CAPTURES}`);
} finally {
  await navigateur.close();
}
process.exitCode = echec ? 1 : 0;
