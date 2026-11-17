import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
const manifeste = JSON.parse(lire("extension/manifest.json"));
const remplir = (texte) =>
  texte.replaceAll("{{version}}", manifeste.version).replaceAll("{{id}}", manifeste.browser_specific_settings.gecko.id);

describe("le paquet de déploiement", () => {
  // Le paquet porte le numéro du manifeste ; Mozilla ne signe qu'une fois un
  // numéro. Deux numéros qui divergent finissent par une signature refusée.
  it("package.json et le manifeste portent la même version", () => {
    assert.equal(JSON.parse(lire("package.json")).version, manifeste.version);
  });

  it("policies.json reste du JSON une fois rempli, et vise l'extension", () => {
    const { policies } = JSON.parse(remplir(lire("deploiement/policies.json")));
    const reglage = policies.ExtensionSettings[manifeste.browser_specific_settings.gecko.id];
    assert.equal(reglage.installation_mode, "force_installed");
    assert.match(reglage.install_url, /^file:\/\/\/.+\.xpi$/);
    assert.equal(reglage.private_browsing, true);
  });

  it("le guide ne laisse aucun gabarit non rempli", () => {
    assert.doesNotMatch(remplir(lire("deploiement/INSTALLER.md")), /\{\{/);
  });
});

describe("la publication et les mises à jour", async () => {
  const { depotDe, manifesteDeMiseAJour, nomXpi } = await import("../scripts/mises-a-jour.mjs");
  const EMPREINTE = "a".repeat(64);

  // L'identifiant est figé à la première signature : en changer ferait de la
  // version suivante une autre extension, sans les réglages ni la liste.
  it("l'identifiant est mister-no-price@mister-guiiug", () => {
    assert.equal(manifeste.browser_specific_settings.gecko.id, "mister-no-price@mister-guiiug");
  });

  // Le catalogue d'addons.mozilla.org refuse une version qui porte une
  // update_url : Firefox met à jour une extension du catalogue depuis le
  // catalogue.
  it("n'a pas d'update_url : publiée sur addons.mozilla.org", () => {
    assert.equal(manifeste.browser_specific_settings.gecko.update_url, undefined);
    assert.doesNotMatch(JSON.parse(lire("package.json")).scripts.lint, /--self-hosted/);
  });

  it("le dépôt des releases est homepage_url", () => {
    assert.equal(depotDe(manifeste), "https://github.com/mister-guiiug/mister-no-prices");
  });

  it("updates.json pointe le .xpi de la release de sa version, avec son empreinte", () => {
    const { addons } = manifesteDeMiseAJour(manifeste, EMPREINTE);
    const [maj] = addons[manifeste.browser_specific_settings.gecko.id].updates;
    assert.equal(maj.version, manifeste.version);
    assert.equal(
      maj.update_link,
      `https://github.com/mister-guiiug/mister-no-prices/releases/download/v${manifeste.version}/${nomXpi(manifeste.version)}`,
    );
    assert.equal(maj.update_hash, `sha256:${EMPREINTE}`);
    assert.equal(maj.applications.gecko.strict_min_version, manifeste.browser_specific_settings.gecko.strict_min_version);
  });

  it("refuse une empreinte invalide et une homepage_url hors GitHub", () => {
    assert.throws(() => manifesteDeMiseAJour(manifeste, "abc"));
    const ailleurs = structuredClone(manifeste);
    ailleurs.homepage_url = "https://exemple.com/";
    assert.throws(() => depotDe(ailleurs));
  });
});

describe("la fiche d'addons.mozilla.org", async () => {
  const fiche = JSON.parse(lire("amo/fiche.json"));
  const { etatDe, jeton } = await import("../scripts/amo.mjs");
  // Les catégories des extensions Firefox dans l'API v5.
  const CATEGORIES = [
    "alerts-updates", "appearance", "bookmarks", "download-management", "feeds-news-blogging",
    "games-entertainment", "language-support", "photos-music-videos", "privacy-security",
    "search-tools", "shopping", "social-communication", "tabs", "web-development", "other",
  ];

  it("a des catégories connues et la licence du dépôt", () => {
    assert.ok(fiche.categories.length >= 1 && fiche.categories.length <= 2);
    for (const c of fiche.categories) assert.ok(CATEGORIES.includes(c), c);
    assert.equal(fiche.version.license, JSON.parse(lire("package.json")).license);
  });

  it("décrit l'extension en français et en anglais, avec le dépôt", () => {
    for (const langue of ["fr", "en-US"]) {
      assert.ok(fiche.description[langue]?.length > 200, langue);
      assert.match(fiche.description[langue], /github\.com\/mister-guiiug\/mister-no-prices/);
    }
  });

  // La fiche ne nomme que des sites que les règles couvrent.
  it("ne cite que des sites des règles", async () => {
    await import("../extension/regles.js");
    const noms = globalThis.SansPrixRegles.map((r) => r.nom);
    const cites = ["Amazon", "Fnac", "Darty", "Boulanger", "Decathlon", "Cdiscount", "eBay", "AliExpress",
      "Zalando", "Leboncoin", "Vinted", "Back Market", "Craigslist", "Facebook Marketplace", "Reverb", "Discogs", "Google"];
    for (const nom of cites) assert.ok(noms.includes(nom), nom);
    for (const nom of cites.filter((n) => n !== "Google")) {
      assert.ok(fiche.description.fr.includes(nom) || fiche.description["en-US"].includes(nom), nom);
    }
  });

  it("lit l'état d'une version d'après son fichier", () => {
    assert.equal(etatDe({ file: { status: "public" } }), "publiee");
    assert.equal(etatDe({ file: { status: "disabled" } }), "refusee");
    assert.equal(etatDe({ file: { status: "unreviewed" } }), "en-relecture");
    assert.equal(etatDe({}), "en-relecture");
  });

  it("signe un jeton HS256 d'une minute, au nom de la clé", () => {
    const [entete, corps, signature] = jeton("user:1:2", "secret", 1000).split(".");
    assert.deepEqual(JSON.parse(Buffer.from(entete, "base64url")), { alg: "HS256", typ: "JWT" });
    const { iss, iat, exp, jti } = JSON.parse(Buffer.from(corps, "base64url"));
    assert.deepEqual([iss, iat, exp], ["user:1:2", 1000, 1060]);
    assert.ok(jti);
    assert.match(signature, /^[A-Za-z0-9_-]{43}$/);
  });
});

describe("le client d'addons.mozilla.org", async () => {
  const { client } = await import("../scripts/amo.mjs");
  const json = (corps) => ({ ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => corps });

  it("cherche la version sur toutes les pages, tous canaux, avec un jeton", async () => {
    const vues = [];
    const fetch = async (url, { headers }) => {
      vues.push(String(url));
      assert.match(headers.Authorization, /^JWT [\w-]+\.[\w-]+\.[\w-]+$/);
      return String(url).includes("page=2")
        ? json({ results: [{ version: "1.8.0", channel: "listed", file: { status: "public" } }], next: null })
        : json({ results: [{ version: "1.7.0" }], next: "https://addons.mozilla.org/api/v5/x/?page=2" });
    };
    const amo = client({ cle: "k", secret: "s", fetch });
    assert.equal((await amo.version("a@b", "1.8.0")).channel, "listed");
    assert.match(vues[0], /addons\/addon\/a%40b\/versions\/\?filter=all_with_unlisted/);
    assert.equal(await amo.version("a@b", "9.9.9"), null);
  });

  it("attend la fin de la relecture, sans dépasser le délai", async () => {
    let appels = 0;
    const fetch = async () => {
      appels += 1;
      return json({ results: [{ version: "1.8.0", file: { status: appels < 3 ? "unreviewed" : "public" } }], next: null });
    };
    const amo = client({ cle: "k", secret: "s", fetch });
    const dormir = async () => {};
    assert.equal((await amo.attendre("a@b", "1.8.0", { delai: 60_000, intervalle: 1, dormir })).file.status, "public");
    appels = -1_000;
    const encore = await amo.attendre("a@b", "1.8.0", { delai: 0, intervalle: 1, dormir });
    assert.equal(encore.file.status, "unreviewed");
  });

  it("refuse une page qui n'est pas du JSON (vérification anti-robot)", async () => {
    const fetch = async () => ({ ok: true, headers: new Headers({ "content-type": "text/html" }) });
    await assert.rejects(client({ cle: "k", secret: "s", fetch }).version("a@b", "1.8.0"), /au lieu de JSON/);
  });
});
