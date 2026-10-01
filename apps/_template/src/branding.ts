/**
 * Application branding, kept apart from the datasets: the title and logo belong
 * to the deployment, not to whichever data it happens to be showing.
 */

export const APP_TITLE = "Genome Browser";

/**
 * Logo shown at the top right, omitted entirely when unset.
 *
 * To add one, drop the file in `src/assets/` and import it:
 *
 * ```ts
 * import logoUrl from "./assets/my-logo.svg";
 * export const LOGO_URL: string | undefined = logoUrl;
 * ```
 *
 * Importing rather than fetching lets Vite fingerprint it into the build, so it
 * is versioned with the app and needs no bucket upload when it changes. A plain
 * URL string works too, if the logo must change without a deploy.
 */
export const LOGO_URL: string | undefined = undefined;

/** Alternative text for the logo, and the tooltip on hover. */
export const LOGO_ALT = "";
