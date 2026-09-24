/**
 * Application branding, kept apart from the datasets: the title and logo belong
 * to the deployment, not to whichever data it happens to be showing.
 */

export const APP_TITLE = "Living Models Genome Browser";

/**
 * Logo shown at the top right, omitted entirely when unset. Any URL the browser
 * can load works; the project's own bucket is the natural home, since it is
 * already public and CORS-enabled:
 *
 *   gcloud storage cp logo.svg gs://living-models-browser-data/brand/
 *
 * then point this at
 * https://storage.googleapis.com/living-models-browser-data/brand/logo.svg
 */
export const LOGO_URL: string | undefined = undefined;

/** Alternative text for the logo, and the tooltip on hover. */
export const LOGO_ALT = "Living Models";
