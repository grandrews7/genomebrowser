import logoUrl from "./assets/living-models-logo.svg";

/**
 * Application branding, kept apart from the datasets: the title and logo belong
 * to the deployment, not to whichever data it happens to be showing.
 */

export const APP_TITLE = "Living Models Genome Browser";

/**
 * Logo shown at the top right, omitted entirely when unset.
 *
 * Imported rather than fetched: Vite fingerprints it into the build, so it is
 * versioned with the app, served from the same origin as the page, and needs no
 * bucket upload when it changes. Swap in a URL string instead if the logo ever
 * needs to be updated without a deploy.
 */
export const LOGO_URL: string | undefined = logoUrl;

/** Alternative text for the logo, and the tooltip on hover. */
export const LOGO_ALT = "Living Models";
