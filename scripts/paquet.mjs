#!/usr/bin/env node
/**
 * Le paquet de déploiement manuel : tout ce qu'il faut pour installer
 * l'extension sans passer par addons.mozilla.org ni par ce dépôt.
 *
 *   web-ext-artifacts/mister-no-price-<version>/
 *   ├── mister-no-price-<version>.zip   l'extension, non signée
 *   ├── mister-no-price-<version>.xpi   la même, signée par Mozilla (si clés)
 *   ├── INSTALLER.md                    les façons d'installer, pas à pas
 *   ├── policies.json                   imposer l'extension sur un poste
 *   └── SHA256SUMS                      empreintes des deux extensions
 *
 * Signature : Firefox n'installe durablement qu'une extension signée. Avec
 * WEB_EXT_API_KEY et WEB_EXT_API_SECRET (clés d'API d'addons.mozilla.org) —
 * dans l'environnement, ou dans un fichier `.env` à la racine, que git ignore —, le
 * script la fait signer sur le canal « unlisted » : Mozilla signe sans publier,
 * en quelques minutes, sans relecture humaine. Sans les clés, le paquet sort
 * sans `.xpi`, et le dit. EXIGER_SIGNATURE=1 transforme ce manque en échec.
 *
 * Mozilla ne signe qu'une fois un numéro de version : relancer la signature
 * d'une version déjà signée échoue. Monter la version d'abord (manifeste et
 * package.json, que les tests gardent alignés).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import webExt from "web-ext";

const racine = path.resolve(import.meta.dirname, "..");
const source = path.join(racine, "extension");

// Les clés d'API, sur le poste : un `.env` ignoré par git. Une variable déjà
// présente dans l'environnement (la CI) l'emporte sur le fichier.
try {
  process.loadEnvFile(path.join(racine, ".env"));
} catch (erreur) {
  if (erreur.code !== "ENOENT") throw erreur;
}
const lireJson = async (fichier) => JSON.parse(await readFile(fichier, "utf8"));

const manifeste = await lireJson(path.join(source, "manifest.json"));
const { version: versionPaquet } = await lireJson(path.join(racine, "package.json"));
const { version } = manifeste;
const id = manifeste.browser_specific_settings.gecko.id;
if (versionPaquet !== version) {
  throw new Error(`package.json (${versionPaquet}) et manifest.json (${version}) divergent`);
}

const nom = `mister-no-price-${version}`;
const dossier = path.join(racine, "web-ext-artifacts", nom);
await rm(dossier, { recursive: true, force: true });
await mkdir(dossier, { recursive: true });

// 1. L'extension non signée.
await webExt.cmd.build(
  {
    sourceDir: source,
    artifactsDir: dossier,
    filename: `${nom}.zip`,
    overwriteDest: true,
  },
  { shouldExitProgram: false },
);
const extensions = [`${nom}.zip`];

// 2. La même, signée, si les clés sont là.
const { WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret } = process.env;
if (apiKey && apiSecret) {
  const telechargement = path.join(dossier, ".signature");
  const { downloadedFiles } = await webExt.cmd.sign(
    {
      sourceDir: source,
      artifactsDir: telechargement,
      apiKey,
      apiSecret,
      channel: "unlisted",
      amoBaseUrl: "https://addons.mozilla.org/api/v5/",
    },
    { shouldExitProgram: false },
  );
  if (downloadedFiles?.length !== 1) {
    throw new Error(`Mozilla devait rendre un fichier signé, pas ${downloadedFiles?.length ?? 0}`);
  }
  await rename(path.resolve(telechargement, path.basename(downloadedFiles[0])), path.join(dossier, `${nom}.xpi`));
  await rm(telechargement, { recursive: true, force: true });
  extensions.push(`${nom}.xpi`);
} else if (process.env.EXIGER_SIGNATURE) {
  throw new Error("EXIGER_SIGNATURE : WEB_EXT_API_KEY et WEB_EXT_API_SECRET manquent");
} else {
  console.warn(
    "Sans clés d'API Mozilla : paquet SANS .xpi signé (installation durable impossible hors Developer Edition).",
  );
}

// 3. Le guide et la stratégie, à la version et à l'identifiant du manifeste.
const remplir = (texte) => texte.replaceAll("{{version}}", version).replaceAll("{{id}}", id);
for (const fichier of ["INSTALLER.md", "policies.json"]) {
  const modele = await readFile(path.join(racine, "deploiement", fichier), "utf8");
  await writeFile(path.join(dossier, fichier), remplir(modele));
}
JSON.parse(await readFile(path.join(dossier, "policies.json"), "utf8"));

// 4. Les empreintes, au format de `sha256sum -c`.
const empreintes = [];
for (const fichier of extensions) {
  const contenu = await readFile(path.join(dossier, fichier));
  empreintes.push(`${createHash("sha256").update(contenu).digest("hex")}  ${fichier}\n`);
}
await writeFile(path.join(dossier, "SHA256SUMS"), empreintes.join(""));

console.log(`\nPaquet ${nom} : ${path.relative(racine, dossier)}`);
for (const fichier of [...extensions, "INSTALLER.md", "policies.json", "SHA256SUMS"]) console.log(`  ${fichier}`);
