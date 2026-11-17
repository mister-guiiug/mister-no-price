/**
 * Le manifeste de mise à jour (`updates.json`) que Firefox lit à l'adresse
 * `update_url` du manifeste de l'extension, pour une extension auto-distribuée.
 *
 * `update_url` vise `…/releases/latest/download/updates.json` : GitHub y sert
 * le fichier joint à la DERNIÈRE release publiée. Chaque release porte donc le
 * sien, qui ne décrit qu'elle-même — Firefox installe la version la plus haute
 * qu'il y trouve, si elle dépasse la sienne. Le `.xpi` est pris dans la release
 * de sa version, par son adresse fixe ; son empreinte garantit qu'on installe
 * bien le fichier signé.
 *
 * https://extensionworkshop.com/documentation/manage/updating-your-extension/
 */

const SUFFIXE = "/releases/latest/download/updates.json";

/** L'adresse du dépôt GitHub, tirée de `update_url`. */
export function depotDe(manifeste) {
  const url = manifeste.browser_specific_settings?.gecko?.update_url ?? "";
  if (!url.startsWith("https://github.com/") || !url.endsWith(SUFFIXE)) {
    throw new Error(`update_url doit viser ${SUFFIXE} d'un dépôt GitHub, pas « ${url} »`);
  }
  return url.slice(0, -SUFFIXE.length);
}

/** Le nom du `.xpi` signé d'une version : celui que la release joint. */
export const nomXpi = (version) => `mister-no-price-${version}.xpi`;

/**
 * @param {object} manifeste le manifest.json de l'extension
 * @param {string} empreinte SHA-256 du `.xpi` signé, en hexadécimal
 */
export function manifesteDeMiseAJour(manifeste, empreinte) {
  if (!/^[0-9a-f]{64}$/.test(empreinte)) throw new Error(`empreinte SHA-256 invalide : ${empreinte}`);
  const { id, strict_min_version } = manifeste.browser_specific_settings.gecko;
  const { version } = manifeste;
  return {
    addons: {
      [id]: {
        updates: [
          {
            version,
            update_link: `${depotDe(manifeste)}/releases/download/v${version}/${nomXpi(version)}`,
            update_hash: `sha256:${empreinte}`,
            applications: { gecko: { strict_min_version } },
          },
        ],
      },
    },
  };
}
