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

describe("les captures de la fiche", async () => {
  const { chargerCaptures, planifier } = await import("../scripts/fiche-amo.mjs");
  const captures = await chargerCaptures();

  it("sont des PNG de 1280 × 800, légendés en français et en anglais, sans doublon", () => {
    assert.ok(captures.length >= 1);
    assert.deepEqual(captures.map((c) => c.position), captures.map((_, i) => i));
  });

  const voulues = [
    { fichier: "a.png", legende: { fr: "A", "en-US": "A en" }, position: 1 },
    { fichier: "b.png", legende: { fr: "B", "en-US": "B en" }, position: 2 },
  ];

  it("ajoute ce qui manque, remet d'aplomb ce qui a bougé, ne touche pas au reste", () => {
    const { ajouter, modifier, etrangeres } = planifier(voulues, [
      { id: 7, caption: { fr: "B", "en-US": "vieux" }, position: 2 },
      { id: 9, caption: { fr: "Faite à la main" }, position: 3 },
    ]);
    assert.deepEqual(ajouter.map((c) => c.fichier), ["a.png"]);
    assert.deepEqual(modifier.map((c) => [c.fichier, c.id]), [["b.png", 7]]);
    assert.deepEqual(etrangeres.map((c) => c.id), [9]);
  });

  it("ne fait rien quand la fiche est à jour", () => {
    const enLigne = voulues.map((c, i) => ({ id: i, caption: c.legende, position: c.position }));
    assert.deepEqual(planifier(voulues, enLigne), { ajouter: [], modifier: [], etrangeres: [] });
  });
});

describe("l'envoi d'une capture", async () => {
  const { client } = await import("../scripts/amo.mjs");
  const json = (corps) => ({ ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: async () => corps });
  const legende = { fr: "Une", "en-US": "One" };

  /** Un faux AMO : la légende posée est effacée `effacements` fois par le retraitement de l'image. */
  function faux(effacements) {
    const appels = [];
    let caption = null;
    const fetch = async (url, { method, headers, body }) => {
      appels.push({ url: String(url), method, type: headers["Content-Type"], corps: body });
      if (method === "POST") return json({ id: 42 });
      if (method === "PATCH") {
        caption = effacements-- > 0 ? null : JSON.parse(body).caption;
        return json({ id: 42 });
      }
      return json({ previews: [{ id: 42, caption, position: 3 }] });
    };
    return { appels, fetch };
  }

  it("envoie l'image en multipart, attend son traitement, légende en JSON, vérifie", async () => {
    const { appels, fetch } = faux(0);
    const attentes = [];
    const capture = await client({ cle: "k", secret: "s", fetch, dormir: async (ms) => attentes.push(ms) }).ajouterCapture(
      "a@b",
      { image: Buffer.from("png"), nom: "1.png", legende, position: 3 },
    );
    assert.deepEqual(appels.map((a) => a.method), ["POST", "PATCH", "GET"]);
    assert.match(appels[0].url, /addons\/addon\/a%40b\/previews\/$/);
    assert.ok(appels[0].corps instanceof FormData);
    assert.equal(appels[0].corps.get("position"), "3");
    assert.match(appels[1].url, /previews\/42\/$/);
    assert.equal(appels[1].type, "application/json");
    assert.deepEqual(JSON.parse(appels[1].corps), { caption: legende, position: 3 });
    assert.deepEqual(attentes, [60_000, 30_000]);
    assert.equal(capture.caption.fr, "Une");
  });

  it("repose la légende qu'AMO a effacée", async () => {
    const { appels, fetch } = faux(1);
    await client({ cle: "k", secret: "s", fetch, dormir: async () => {} }).ajouterCapture("a@b", {
      image: Buffer.from("png"), nom: "1.png", legende, position: 3,
    });
    assert.deepEqual(appels.map((a) => a.method), ["POST", "PATCH", "GET", "PATCH", "GET"]);
  });

  it("abandonne et retire la capture après trois effacements", async () => {
    const { appels, fetch } = faux(10);
    await assert.rejects(
      client({ cle: "k", secret: "s", fetch, dormir: async () => {} }).ajouterCapture("a@b", {
        image: Buffer.from("png"), nom: "1.png", legende, position: 3,
      }),
      /effacée 3 fois/,
    );
    assert.equal(appels.at(-1).method, "DELETE");
  });
});

describe("la fiche tenue par le dépôt", async () => {
  const { ficheVoulue, ecarts, iconeParDefaut } = await import("../scripts/fiche-amo.mjs");
  const voulue = await ficheVoulue();

  it("prend le nom et le résumé des messages français et anglais, la page d'accueil du manifeste", () => {
    assert.equal(voulue.name.fr, "Sans prix");
    assert.equal(voulue.name["en-US"], "No Prices");
    assert.ok(voulue.summary.fr.length > 20);
    assert.equal(voulue.homepage.fr, manifeste.homepage_url);
  });

  it("ne modifie que ce qui diffère, page d'accueil lue sous ses liens sortants", () => {
    const enLigne = {
      ...structuredClone(voulue),
      homepage: { url: { fr: "https://github.com/mister-guiiug/mister-no-price", "en-US": voulue.homepage["en-US"] }, outgoing: {} },
      summary: { fr: "Ancien résumé", "en-US": voulue.summary["en-US"] },
    };
    assert.deepEqual(Object.keys(ecarts(voulue, enLigne)).sort(), ["homepage", "summary"]);
    const aJour = { ...structuredClone(voulue), homepage: { url: voulue.homepage, outgoing: {} } };
    assert.deepEqual(ecarts(voulue, aJour), {});
  });

  it("reconnaît l'icône par défaut", () => {
    assert.ok(iconeParDefaut({ icon_url: "https://addons.mozilla.org/static-server/img/addon-icons/default-64.png" }));
    assert.ok(!iconeParDefaut({ icon_url: "https://addons.mozilla.org/user-media/addon_icons/3/123-64.png?modified=1" }));
  });
});

describe("le débit limité d'addons.mozilla.org", async () => {
  const { client, delaiDemande } = await import("../scripts/amo.mjs");
  const json = (corps, status = 200) => ({
    ok: status < 400, status, headers: new Headers({ "content-type": "application/json" }),
    json: async () => corps, text: async () => JSON.stringify(corps),
  });

  it("lit le délai demandé", () => {
    assert.equal(delaiDemande(new Headers({ "retry-after": "12" }), ""), 12_000);
    assert.equal(delaiDemande(new Headers(), '{"detail":"Request was throttled. Expected available in 59 seconds."}'), 59_000);
    assert.equal(delaiDemande(new Headers(), ""), 60_000);
  });

  it("attend puis reprend la requête sur un 429", async () => {
    const attentes = [];
    let n = 0;
    const fetch = async () => (++n === 1 ? json({ detail: "Expected available in 3 seconds." }, 429) : json({ id: 5 }));
    const amo = client({ cle: "k", secret: "s", fetch, dormir: async (ms) => attentes.push(ms) });
    assert.deepEqual(await amo.modifierCapture("a@b", 5, { legende: { fr: "x" }, position: 1 }), { id: 5 });
    assert.deepEqual(attentes, [4_000]);
  });

  it("s'arrête plutôt que de patienter une demi-heure", async () => {
    const { DebitEpuise } = await import("../scripts/amo.mjs");
    const fetch = async () => json({ detail: "Expected available in 1894 seconds." }, 429);
    const amo = client({ cle: "k", secret: "s", fetch, dormir: async () => assert.fail("ne doit pas attendre") });
    await assert.rejects(amo.modifierCapture("a@b", 5, { legende: { fr: "x" }, position: 1 }), DebitEpuise);
  });

  it("retire la capture envoyée si sa légende échoue", async () => {
    const methodes = [];
    const fetch = async (url, { method }) => {
      methodes.push(method);
      if (method === "POST") return json({ id: 8 });
      if (method === "PATCH") return json({ detail: "non" }, 400);
      return { ok: true, status: 204, headers: new Headers(), text: async () => "" };
    };
    const amo = client({ cle: "k", secret: "s", fetch, dormir: async () => {} });
    await assert.rejects(amo.ajouterCapture("a@b", { image: Buffer.from("x"), nom: "a.png", legende: { fr: "a" }, position: 1 }), /AMO 400/);
    assert.deepEqual(methodes, ["POST", "PATCH", "DELETE"]);
  });
});
