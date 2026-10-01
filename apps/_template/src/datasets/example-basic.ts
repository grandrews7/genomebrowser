import type { Dataset } from "./types";
import { dataset as example } from "./example";

/**
 * A second view, to show what the dataset picker is for.
 *
 * Views that differ in a few fields are cheaper to derive than to copy: spread
 * the first and override. A real project would more often vary the track lists
 * than the annotation - one view per study, or raw signal beside model output -
 * but the mechanism is the same.
 *
 * Every option in ../config.ts must share one assembly. The browser store binds
 * its assembly at creation, so a second genome needs a second store, and
 * App.tsx throws on load rather than rendering coordinates that mean nothing.
 */
export const dataset = {
  ...example,
  /** The curated transcript subset, rather than every isoform. */
  GENE_TRACK_VARIANT: "basic",
  GENE_TRACK_DISPLAY: "merged",
  GENE_TRACK_HEIGHT: 80,
} satisfies Dataset;
