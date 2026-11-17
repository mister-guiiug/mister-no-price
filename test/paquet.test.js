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

  it("update_url vise le updates.json de la dernière release du dépôt", () => {
    assert.equal(depotDe(manifeste), "https://github.com/mister-guiiug/mister-no-prices");
    assert.equal(manifeste.homepage_url, depotDe(manifeste));
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

  it("refuse une empreinte invalide et une update_url hors GitHub", () => {
    assert.throws(() => manifesteDeMiseAJour(manifeste, "abc"));
    const ailleurs = structuredClone(manifeste);
    ailleurs.browser_specific_settings.gecko.update_url = "https://exemple.com/updates.json";
    assert.throws(() => depotDe(ailleurs));
  });
});
