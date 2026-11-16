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
