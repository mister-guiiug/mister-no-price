import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

const lire = (chemin) => readFileSync(new URL(`../extension/${chemin}`, import.meta.url), "utf8");

/** Un `browser` minimal : storage.local et storage.sync en mémoire, écouteurs notés. */
function fauxNavigateur({ android = false } = {}) {
  const zones = { local: {}, sync: {} };
  const ecouteurs = { stockage: [], commandes: [] };
  const zone = (nom) => ({
    async get(defauts) {
      const valeurs = typeof defauts === "object" && defauts ? { ...defauts } : {};
      return { ...valeurs, ...structuredClone(zones[nom]) };
    },
    async set(valeurs) {
      Object.assign(zones[nom], structuredClone(valeurs));
    },
    async remove(cle) {
      delete zones[nom][cle];
    },
  });
  const evenement = () => ({ addListener() {} });
  const browser = {
    storage: {
      local: zone("local"),
      sync: zone("sync"),
      onChanged: { addListener: (f) => ecouteurs.stockage.push(f) },
    },
    i18n: { getMessage: (cle) => cle },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {},
    },
    permissions: { contains: async () => true, onAdded: evenement(), onRemoved: evenement() },
    runtime: { onStartup: evenement(), onInstalled: evenement() },
  };
  // Firefox pour Android n'a pas l'API des raccourcis clavier.
  if (!android) browser.commands = { onCommand: { addListener: (f) => ecouteurs.commandes.push(f) } };
  return { browser, zones, ecouteurs };
}

function charger(fichiers, navigateur) {
  const contexte = vm.createContext({ browser: navigateur.browser, console });
  for (const f of fichiers) vm.runInContext(lire(f), contexte, { filename: f });
  return contexte;
}

const produit = vm.createContext({});
vm.runInContext(lire("content/produit.js"), produit);
const { lireMontant, lireDevise } = produit.SansPrixProduit;

describe("lireMontant", () => {
  const cas = [
    ["11,99€", 11.99],
    ["1 234,56 €", 1234.56],
    ["$1,234.56", 1234.56],
    ["EUR72.56", 72.56],
    ["34€99", 34.99],
    ["1.234", 1234],
    ["149", 149],
    [99.99, 99.99],
    // Le composant prix d'Amazon mobile : texte d'accessibilité, puis morceaux.
    ["26,06 €€2606", 26.06],
    ["", null],
    ["Gratuit", null],
  ];
  for (const [brut, attendu] of cas) {
    it(`${JSON.stringify(brut)} → ${attendu}`, () => assert.equal(lireMontant(brut), attendu));
  }
});

describe("lireDevise", () => {
  const cas = [
    ["EUR", "EUR"],
    ["12,99 €", "EUR"],
    ["£5.00", "GBP"],
    ["EUR72.56", "EUR"],
    ["CHF 12.–", "CHF"],
    ["12", null],
  ];
  for (const [brut, attendu] of cas) {
    it(`${JSON.stringify(brut)} → ${attendu}`, () => assert.equal(lireDevise(brut), attendu));
  }
});

describe("la liste d'envies", () => {
  const nouvelle = () => {
    const navigateur = fauxNavigateur();
    return { ...navigateur, Envies: charger(["commun/envies.js"], navigateur).SansPrixEnvies };
  };

  it("ajoute en tête, sans doublon d'adresse", async () => {
    const { Envies } = nouvelle();
    await Envies.ajouter({ url: "https://a/1", titre: "Un" });
    await Envies.ajouter({ url: "https://a/2", titre: "Deux", prix: 12.5, devise: "EUR" });
    await Envies.ajouter({ url: "https://a/1", titre: "Un, revu" });
    const liste = await Envies.lire();
    assert.deepEqual(
      liste.map((a) => [a.url, a.titre]),
      [
        ["https://a/1", "Un, revu"],
        ["https://a/2", "Deux"],
      ],
    );
    assert.equal(liste[1].prix, 12.5);
    assert.ok(await Envies.contient("https://a/2"));
  });

  it("retire, vide, et ignore une entrée abîmée", async () => {
    const { Envies, zones } = nouvelle();
    await Envies.ajouter({ url: "https://a/1", titre: "Un" });
    await Envies.ajouter({ url: "https://a/2", titre: "Deux" });
    await Envies.retirer("https://a/1");
    assert.deepEqual((await Envies.lire()).map((a) => a.url), ["https://a/2"]);
    zones.local.envies.push({ titre: "sans adresse" }, null);
    assert.equal((await Envies.lire()).length, 1);
    await Envies.vider();
    assert.equal((await Envies.lire()).length, 0);
  });

  it(`ne garde que les ${200} derniers`, async () => {
    const { Envies } = nouvelle();
    for (let i = 0; i < Envies.MAX + 5; i += 1) await Envies.ajouter({ url: `https://a/${i}`, titre: `${i}` });
    const liste = await Envies.lire();
    assert.equal(liste.length, Envies.MAX);
    assert.equal(liste[0].url, `https://a/${Envies.MAX + 4}`);
  });
});

describe("l'arrière-plan", () => {
  const FICHIERS = ["commun/reglages.js", "regles.js", "content/moteur.js", "commun/acces.js", "background.js"];

  // Firefox pour Android n'a pas `browser.commands` : y toucher sans garde levait
  // une erreur qui empêchait le reste du script — pastille, suivi des réglages —
  // de s'enregistrer.
  it("démarre sous Firefox pour Android, sans API des raccourcis", () => {
    const navigateur = fauxNavigateur({ android: true });
    charger(FICHIERS, navigateur);
    assert.equal(navigateur.ecouteurs.stockage.length, 1);
  });

  it("écoute le raccourci là où il existe", () => {
    const navigateur = fauxNavigateur();
    charger(FICHIERS, navigateur);
    assert.equal(navigateur.ecouteurs.commandes.length, 1);
    assert.equal(navigateur.ecouteurs.stockage.length, 1);
  });
});

describe("les réglages", () => {
  it("montrent le bouton ♥ par défaut, et le cachent sur demande", async () => {
    const navigateur = fauxNavigateur();
    const { SansPrixReglages: R } = charger(["commun/reglages.js"], navigateur);
    assert.equal((await R.lire()).envies, true);
    await R.ecrire({ envies: false });
    assert.equal((await R.lire()).envies, false);
  });
});

describe("les traductions", () => {
  it("le français et l'anglais ont les mêmes clés", () => {
    const cles = (langue) => Object.keys(JSON.parse(lire(`_locales/${langue}/messages.json`))).sort();
    assert.deepEqual(cles("en"), cles("fr"));
  });
});
