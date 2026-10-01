import { hg38 } from "@weng-lab/genomebrowser";
import type { BamTrack, BigBedTrack, Dataset, DynseqTrack, SignalTrack } from "./types";

/**
 * A working starting point: hg38 with gene models and nothing to host.
 *
 * Copy this file, point it at your data, and name it in ../config.ts. Every
 * member below is required - `satisfies Dataset` at the bottom turns a missing
 * or misspelled one into a compile error rather than a silently empty track.
 *
 * The track arrays are empty and documented rather than filled, because any URL
 * shipped in a template eventually rots. The commented examples show the shape
 * of each; delete the ones you do not need.
 */

/** The genome. Regions are validated and normalised against it. */
export const ASSEMBLY = hg38;

/** Opening view. Format: "chr:start-end". */
export const INITIAL_REGION = "chr12:120978543-121002512";

export const SHOW_GENE_TRACK = true;

/**
 * hg38 and mm10 are covered by the packaged GENCODE catalog, so leaving
 * GENE_TRACK_URL undefined gets gene models with nothing to host. Available
 * hg38 releases: 29, 40, 46, 47, 48, 49, 50.
 *
 * Any other assembly needs its own BigGenePred BigBed in GENE_TRACK_URL, built
 * from a GTF; the Arabidopsis app's DEPLOY.md documents how.
 */
export const GENCODE_RELEASE = "47";
export const GENE_TRACK_VARIANT: "basic" | "comprehensive" = "comprehensive";
export const GENE_TRACK_URL: string | undefined = undefined;
export const GENE_TRACK_TITLE: string | undefined = undefined;

/** "full" gives each transcript a row; "merged" collapses them onto one. */
export const GENE_TRACK_DISPLAY: "full" | "merged" | "tagged" = "full";
export const GENE_TRACK_HEIGHT = 220;

/** Optional: highlight transcripts whose name matches, e.g. "HNF1A". */
export const HIGHLIGHT_GENE: string | undefined = undefined;
export const HIGHLIGHT_COLOR = "#1f77b4";

/** Colour transcripts carrying a tag, so canonical ones stand out. */
export const GENE_TAG_COLORS = [{ tag: "MANE_Select", color: "#d45c2f" }];

/**
 * Genome sequence, used by dynseq tracks to draw nucleotide letters when zoomed
 * in. Only read when a dynseq track asks for it.
 */
export const TWO_BIT_URL = "YOUR_URL_HERE";

/**
 * bigWig signal.
 *
 * Every URL here, and in the arrays below, must be reachable over HTTPS with
 * CORS and HTTP range requests. Local files avoid both: drop them in `public/`
 * and reference them as "/my-sample.bw".
 *
 *   { id: "sample-1", title: "Sample 1", url: `${BASE}/sample.bw`,
 *     color: "#2266aa", height: 60, yRange: { min: 0, max: 5 } }
 */
export const SIGNAL_TRACKS: SignalTrack[] = [];

/**
 * BAM alignments, drawn as stacked sections: `display` sets the read layout
 * alone, while coverage, junctions and the pileup are toggled separately.
 *
 * Read names are drawn at "pack" or "full" when the row is 10px or taller,
 * which at a few thousand bases is wider than the read it names - "squish"
 * halves the row and drops them.
 *
 *   { id: "rna", title: "RNA-seq", url: `${BASE}/sample.bam`,
 *     display: "squish", showCoverage: true, showJunctions: true,
 *     maxAlignmentRows: 40, maxWindow: 30000, maxJunctionSpan: 10000 }
 *
 * The index defaults to <url>.bai. Leave minMappingQuality at 0 for STAR
 * output: STAR writes 255 for uniquely mapped reads where the SAM spec means
 * "unavailable", so filtering keeps the multimappers and drops the rest.
 */
export const BAM_TRACKS: BamTrack[] = [];

/**
 * Per-base scores - conservation, model contributions - drawn as a filled
 * signal that becomes scaled nucleotide letters when zoomed in. Needs
 * TWO_BIT_URL set.
 *
 *   { id: "phylop", title: "phyloP", url: `${BASE}/phylop.bw`, height: 100 }
 */
export const DYNSEQ_TRACKS: DynseqTrack[] = [];

/**
 * Interval annotations from a BigBed: motif hits, peaks, any BED-like feature.
 *
 *   { id: "peaks", title: "Peaks", url: `${BASE}/peaks.bb`,
 *     bedSchema: "bed6", display: "squish", height: 60 }
 */
export const BIGBED_TRACKS: BigBedTrack[] = [];

/** Fails to compile if anything above is missing or the wrong shape. */
export const dataset = {
  ASSEMBLY,
  INITIAL_REGION,
  SHOW_GENE_TRACK,
  GENCODE_RELEASE,
  GENE_TRACK_VARIANT,
  GENE_TRACK_URL,
  GENE_TRACK_TITLE,
  GENE_TRACK_DISPLAY,
  GENE_TRACK_HEIGHT,
  HIGHLIGHT_GENE,
  HIGHLIGHT_COLOR,
  GENE_TAG_COLORS,
  TWO_BIT_URL,
  SIGNAL_TRACKS,
  BAM_TRACKS,
  DYNSEQ_TRACKS,
  BIGBED_TRACKS,
} satisfies Dataset;
