/**
 * Le manifeste de mise à jour (`updates.json`) que Firefox lit à l'adresse
 * `update_url` des versions auto-distribuées, jusqu'à la 1.7.0. Depuis la 1.8.0,
 * l'extension est publiée sur addons.mozilla.org et n'a plus d'`update_url` :
 * Firefox la met à jour depuis le catalogue. Ce fichier reste joint à chaque
 * release pour les installations antérieures — c'est par lui qu'elles passent
 * à la version du catalogue.
 *
 * Leur `update_url` vise `…/releases/latest/download/updates.json` : GitHub y
 * sert le fichier joint à la DERNIÈRE release publiée. Chaque release porte donc le
 * sien, qui ne décrit qu'elle-même — Firefox installe la version la plus haute
 * qu'il y trouve, si elle dépasse la sienne. Le `.xpi` est pris dans la release
 * de sa version, par son adresse fixe ; son empreinte garantit qu'on installe
 * bien le fichier signé.
 *
 * https://extensionworkshop.com/documentation/manage/updating-your-extension/
 */

/** L'adresse du dépôt GitHub, tirée de `homepage_url`. */
export function depotDe(manifeste) {
  const url = manifeste.homepage_url ?? "";
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(url)) {
    throw new Error(`homepage_url doit être l'adresse d'un dépôt GitHub, pas « ${url} »`);
  }
  return url;
}

/** Le nom du `.xpi` signé d'une version : celui que la release joint. */
export const nomXpi = (version) => `mister-no-prices-${version}.xpi`;

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
