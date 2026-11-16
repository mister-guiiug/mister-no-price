import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

// Les règles et le moteur sont des scripts classiques : on les exécute tels que
// le content script les charge, dans un contexte isolé.
const lire = (chemin) => readFileSync(new URL(`../extension/${chemin}`, import.meta.url), "utf8");
const contexte = vm.createContext({});
vm.runInContext(lire("regles.js"), contexte);
vm.runInContext(lire("content/moteur.js"), contexte);
const { SansPrixRegles: REGLES, SansPrixMoteur: moteur } = contexte;
const manifeste = JSON.parse(lire("manifest.json"));

const idDe = (hote) => moteur.trouverRegle(hote, REGLES)?.id ?? null;

describe("trouverRegle", () => {
  const cas = [
    ["www.amazon.fr", "amazon"],
    ["amazon.fr", "amazon"],
    ["www.amazon.com", "amazon"],
    ["www.amazon.it", "amazon"],
    ["www.amazon.co.uk", "amazon"],
    ["www.dealabs.com", "dealabs"],
    ["www.decathlon.fr", "decathlon"],
    ["www.cdiscount.com", "cdiscount"],
    ["WWW.CDISCOUNT.COM.", "cdiscount"],
    // Domaine de premier niveau d'enseigne, sous-domaines de langue ou de service.
    ["www.e.leclerc", "leclerc"],
    ["www.leclerc.fr", "leclerc"],
    ["fr.aliexpress.com", "aliexpress"],
    ["fr.shopping.rakuten.com", "rakuten"],
    ["www.ebay.com", "ebay"],
    ["www.rueducommerce.fr", "rueducommerce"],
    // Google : la recherche et Images, jamais les autres services du domaine.
    ["www.google.fr", "google"],
    ["www.google.com", "google"],
    ["mail.google.com", null],
    ["docs.google.com", null],
    ["google.fr", null],
    // Un domaine qui ne fait que ressembler n'est pas couvert.
    ["mon-amazon.fr", null],
    ["amazon.fr.exemple.com", null],
    ["www.exemple.com", null],
  ];
  for (const [hote, attendu] of cas) {
    it(`${hote} → ${attendu}`, () => assert.equal(idDe(hote), attendu));
  }
});

describe("construireFeuille", () => {
  const feuille = moteur.construireFeuille([".prix", '[class*="tarif"]']);

  it("couvre chaque sélecteur et les prix éclatés", () => {
    assert.match(feuille, /\.prix,/);
    assert.match(feuille, /\[class\*="tarif"\]/);
    assert.ok(feuille.includes(`[${moteur.ATTRIBUT_ECLATE}]`));
  });

  it("échoue fermée : tout est conditionné à l'absence de data-sans-prix=\"off\"", () => {
    assert.ok(feuille.startsWith(':root:not([data-sans-prix="off"]) :is('));
  });

  it("propose la barre et le flou", () => {
    assert.match(feuille, /:root:not\(\[data-sans-prix-style="flou"\]\) &/);
    assert.match(feuille, /:root\[data-sans-prix-style="flou"\] &/);
  });

  it("sans règle, couvre encore les prix éclatés", () => {
    assert.ok(moteur.construireFeuille([]).includes(`[${moteur.ATTRIBUT_ECLATE}]`));
  });
});

describe("les règles", () => {
  it("ont un id unique, en minuscules", () => {
    const ids = REGLES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
  });

  // `masquer` peut être vide : le site ne compte alors que sur le générique
  // (texte, prix éclatés, titre). C'est le cas d'un site dont le balisage n'a
  // pas pu être relevé — mais la liste doit exister.
  it("ont un nom, des domaines ou des hôtes, et une liste de sélecteurs", () => {
    for (const r of REGLES) {
      assert.ok(r.nom, r.id);
      assert.ok(r.domaines.length + r.hotes.length > 0, r.id);
      assert.ok(Array.isArray(r.masquer), r.id);
    }
  });

  it("ne se disputent aucun domaine ni aucun hôte", () => {
    const tous = REGLES.flatMap((r) => [...r.domaines, ...r.hotes]);
    assert.equal(new Set(tous).size, tous.length);
  });

  it("ont des domaines nus, sans schéma ni sous-domaine www", () => {
    for (const d of REGLES.flatMap((r) => r.domaines)) {
      assert.match(d, /^(?!www\.)[a-z0-9-]+(\.[a-z0-9-]+)+$/, d);
    }
  });

  it("ont des hôtes exacts, sans schéma ni joker", () => {
    for (const h of REGLES.flatMap((r) => r.hotes)) {
      assert.match(h, /^[a-z0-9-]+(\.[a-z0-9-]+){2,}$/, h);
    }
  });

  // Un sélecteur est recopié dans une feuille de style : une accolade y fermerait
  // la règle et ouvrirait la porte à n'importe quelle déclaration.
  it("ont des sélecteurs sans accolade ni commentaire", () => {
    for (const s of REGLES.flatMap((r) => r.masquer)) {
      assert.doesNotMatch(s, /[{}]|\/\*/, s);
      assert.equal(s, s.trim(), s);
    }
  });
});

describe("le manifeste", () => {
  const [script] = manifeste.content_scripts;

  // Une règle sans motif dans le manifeste ne s'appliquerait jamais ; un motif
  // sans règle injecterait le script pour rien. Les deux listes vont ensemble.
  it("déclare exactement les domaines et les hôtes des règles", () => {
    const attendus = moteur.motifsDuManifeste(REGLES);
    assert.deepEqual([...script.matches].sort(), [...attendus].sort());
  });

  // Le popup demande les accès qu'une mise à jour a ajoutés : Firefox n'accepte
  // de les demander que s'ils sont déclarés dans host_permissions.
  it("déclare les mêmes motifs en host_permissions", () => {
    const attendus = moteur.motifsDuManifeste(REGLES);
    assert.deepEqual([...manifeste.host_permissions].sort(), [...attendus].sort());
  });

  // Le domaine google.com entier ferait tourner l'extension dans Gmail ou Docs.
  it("ne déclare aucun motif sur tout un domaine de Google", () => {
    assert.ok(!script.matches.some((m) => /^\*:\/\/\*\.google\./.test(m)));
  });

  it("charge les règles et le moteur avant le script de masquage", () => {
    const ordre = (f) => script.js.indexOf(f);
    for (const f of ["commun/reglages.js", "regles.js", "content/detection.js", "content/moteur.js"]) {
      assert.ok(ordre(f) >= 0 && ordre(f) < ordre("content/masquage.js"), f);
    }
  });
});
