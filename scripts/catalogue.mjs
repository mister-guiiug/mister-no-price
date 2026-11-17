#!/usr/bin/env node
/**
 * Le catalogue distant, `regles/regles.json`, tiré de `extension/regles.js`.
 *
 *   npm run catalogue                          # écrit regles/regles.json
 *   node scripts/catalogue.mjs --verifier      # échoue s'il n'est pas à jour
 *   node scripts/catalogue.mjs --revision-depuis origin/main
 *                                              # échoue si les règles ont
 *                                              # changé sans monter la révision
 *
 * regles.js reste le fichier qu'on écrit — avec ses commentaires, qui disent
 * pourquoi chaque sélecteur — et le catalogue embarqué dans l'extension.
 * regles.json en est la copie en données pures que les installations lisent
 * chaque jour sur main : la publier, c'est fusionner. Le catalogue est validé
 * par le même code que l'extension (commun/catalogue.js) avant d'être écrit.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const racine = path.resolve(import.meta.dirname, "..");
const fichier = path.join(racine, "regles", "regles.json");

/** Charge regles.js et catalogue.js comme le ferait l'extension. */
export function chargerCatalogue() {
  const contexte = vm.createContext({ browser: {} });
  for (const f of ["regles.js", "commun/catalogue.js"]) {
    vm.runInContext(readFileSync(path.join(racine, "extension", f), "utf8"), contexte, { filename: f });
  }
  return contexte.SansPrixCatalogue;
}

/** Le JSON du catalogue embarqué, tel que regles.json doit le contenir. */
export function jsonDuCatalogue() {
  const { EMBARQUE, valider } = chargerCatalogue();
  const donnees = {
    format: EMBARQUE.format,
    revision: EMBARQUE.revision,
    regles: EMBARQUE.regles.map((r) => {
      const regle = { id: r.id, nom: r.nom };
      if (r.domaines.length) regle.domaines = [...r.domaines];
      if (r.hotes.length) regle.hotes = [...r.hotes];
      if (r.chemins) regle.chemins = [...r.chemins];
      regle.masquer = [...r.masquer];
      if (r.fiche) regle.fiche = { ...r.fiche };
      return regle;
    }),
  };
  valider(JSON.parse(JSON.stringify(donnees)));
  return `${JSON.stringify(donnees, null, 2)}\n`;
}

function principal() {
  const args = process.argv.slice(2);
  const attendu = jsonDuCatalogue();

  if (args[0] === "--verifier") {
    if (readFileSync(fichier, "utf8") !== attendu) {
      console.error("regles/regles.json n'est pas à jour : npm run catalogue");
      process.exit(1);
    }
    console.log("regles/regles.json est à jour.");
    return;
  }

  if (args[0] === "--revision-depuis") {
    const ref = args[1];
    let avant;
    try {
      avant = JSON.parse(
        execFileSync("git", ["show", `${ref}:regles/regles.json`], {
          cwd: racine,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
    } catch {
      console.log(`Pas de regles/regles.json sur ${ref} : rien à comparer.`);
      return;
    }
    const apres = JSON.parse(attendu);
    if (JSON.stringify(avant.regles) === JSON.stringify(apres.regles)) {
      console.log("Règles inchangées.");
      return;
    }
    const { comparerRevisions } = chargerCatalogue();
    if (comparerRevisions(apres.revision, avant.revision) <= 0) {
      console.error(
        `Les règles ont changé, mais la révision reste ${apres.revision} (${ref} : ${avant.revision}). ` +
          "Monter `revision` dans extension/regles.js, puis npm run catalogue : sans cela, aucune installation ne les adopterait.",
      );
      process.exit(1);
    }
    console.log(`Règles changées, révision ${avant.revision} → ${apres.revision}.`);
    return;
  }

  mkdirSync(path.dirname(fichier), { recursive: true });
  writeFileSync(fichier, attendu);
  console.log(`regles/regles.json écrit (révision ${JSON.parse(attendu).revision}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
