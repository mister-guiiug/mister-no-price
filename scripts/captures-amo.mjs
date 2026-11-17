#!/usr/bin/env node
/**
 * Les captures d'écran de la fiche addons.mozilla.org, tenues par le dépôt :
 * `amo/captures.json` dit lesquelles, dans quel ordre, avec quelle légende
 * (français et anglais) ; les images sont dans `amo/captures/`.
 *
 * Une capture est reconnue sur la fiche par sa légende française :
 *   - absente de la fiche : envoyée, puis légendée et placée ;
 *   - présente : sa légende anglaise et sa place sont remises d'aplomb, l'image
 *     n'est pas renvoyée — pour changer l'image, changer la légende ;
 *   - sur la fiche mais pas dans le fichier : signalée, JAMAIS supprimée (elle a
 *     pu être ajoutée à la main).
 *
 * Relancer ne double donc rien. Clés : WEB_EXT_API_KEY, WEB_EXT_API_SECRET.
 * Joué par fiche-amo.yml quand amo/ change sur main.
 *
 *   node scripts/captures-amo.mjs            synchronise
 *   node scripts/captures-amo.mjs --verifier vérifie seulement le fichier
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { client } from "./amo.mjs";

const racine = path.resolve(import.meta.dirname, "..");

/** Les captures déclarées, vérifiées : fichiers présents, PNG 1280 × 800, légendes fr et en-US. */
export async function chargerCaptures(dossier = path.join(racine, "amo")) {
  const liste = JSON.parse(await readFile(path.join(dossier, "captures.json"), "utf8"));
  if (!Array.isArray(liste) || liste.length === 0) throw new Error("captures.json : une liste non vide");
  const vues = new Set();
  return Promise.all(
    liste.map(async ({ fichier, legende }, rang) => {
      if (!/^[\w-]+\.png$/.test(fichier ?? "")) throw new Error(`captures.json[${rang}] : nom de fichier « ${fichier} »`);
      for (const langue of ["fr", "en-US"]) {
        const texte = legende?.[langue];
        if (typeof texte !== "string" || texte.trim().length === 0 || texte.length > 280) {
          throw new Error(`${fichier} : légende ${langue} manquante ou trop longue`);
        }
      }
      if (vues.has(legende.fr)) throw new Error(`${fichier} : légende française en double`);
      vues.add(legende.fr);
      const image = await readFile(path.join(dossier, "captures", fichier));
      // En-tête PNG puis IHDR : largeur et hauteur en octets 16 à 23.
      if (image.subarray(1, 4).toString() !== "PNG") throw new Error(`${fichier} n'est pas un PNG`);
      const [largeur, hauteur] = [image.readUInt32BE(16), image.readUInt32BE(20)];
      if (largeur !== 1280 || hauteur !== 800) throw new Error(`${fichier} : ${largeur} × ${hauteur}, 1280 × 800 attendu`);
      return { fichier, legende, image, position: rang + 1 };
    }),
  );
}

/** Ce qu'il faut faire pour que la fiche montre `voulues`, d'après ses captures `enLigne`. */
export function planifier(voulues, enLigne) {
  const parLegende = new Map(enLigne.map((c) => [c.caption?.fr, c]));
  const ajouter = [];
  const modifier = [];
  for (const capture of voulues) {
    const existante = parLegende.get(capture.legende.fr);
    if (!existante) ajouter.push(capture);
    else if (existante.position !== capture.position || existante.caption?.["en-US"] !== capture.legende["en-US"]) {
      modifier.push({ ...capture, id: existante.id });
    }
  }
  const voulu = new Set(voulues.map((c) => c.legende.fr));
  const etrangeres = enLigne.filter((c) => !voulu.has(c.caption?.fr));
  return { ajouter, modifier, etrangeres };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const captures = await chargerCaptures();
  if (process.argv.includes("--verifier")) {
    console.log(`${captures.length} captures prêtes : ${captures.map((c) => c.fichier).join(", ")}`);
    process.exit(0);
  }
  try {
    process.loadEnvFile(path.join(racine, ".env"));
  } catch (erreur) {
    if (erreur.code !== "ENOENT") throw erreur;
  }
  const { WEB_EXT_API_KEY: cle, WEB_EXT_API_SECRET: secret } = process.env;
  if (!cle || !secret) throw new Error("WEB_EXT_API_KEY et WEB_EXT_API_SECRET manquent");
  const manifeste = JSON.parse(await readFile(path.join(racine, "extension", "manifest.json"), "utf8"));
  const id = manifeste.browser_specific_settings.gecko.id;
  const amo = client({ cle, secret });

  const { ajouter, modifier, etrangeres } = planifier(captures, await amo.captures(id));
  for (const c of ajouter) {
    await amo.ajouterCapture(id, { image: c.image, nom: c.fichier, legende: c.legende, position: c.position });
    console.log(`ajoutée : ${c.fichier}`);
  }
  for (const c of modifier) {
    await amo.modifierCapture(id, c.id, { legende: c.legende, position: c.position });
    console.log(`remise d'aplomb : ${c.fichier}`);
  }
  for (const c of etrangeres) {
    console.log(`::warning::capture ${c.id} sur la fiche mais pas dans amo/captures.json (« ${c.caption?.fr ?? "sans légende"} ») : laissée en place`);
  }
  const finales = await amo.captures(id);
  console.log(`Fiche : ${finales.length} capture(s). ${ajouter.length} ajoutée(s), ${modifier.length} remise(s) d'aplomb.`);
}
