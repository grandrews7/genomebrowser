import { hg38 } from "@weng-lab/genomebrowser";

/**
 * ============================================================
 *  THIS IS THE ONLY FILE YOU NEED TO EDIT.
 * ============================================================
 *
 * Point the track lists below at your files and set a starting region.
 *
 * Notes on URLs:
 *  - They must be reachable from the browser over HTTP(S).
 *  - The server must support HTTP Range requests (the browser reads only the
 *    slice of the file it needs, not the whole file).
 *  - If the files are on a different host than this dev server, that host must
 *    send permissive CORS headers, including
 *    Access-Control-Allow-Headers: range and
 *    Access-Control-Expose-Headers: content-range.
 *  - Local files: drop them in ./public and use "/my-sample.bw".
 */

/** Genome assembly. The browser validates every region against it. */
export const ASSEMBLY = hg38;

/** Starting view. Format: "chr:start-end". */
export const INITIAL_REGION = "chr12:120978543-121002512"; // HNF1A, hg38

/** Set false to hide the GENCODE gene annotation track. */
export const SHOW_GENE_TRACK = true;

/**
 * Which GENCODE release and variant to load from the track package's catalog.
 * "comprehensive" gives every isoform per gene; "basic" is the curated subset.
 * Available hg38 releases: 29, 40, 46, 47, 48, 49, 50.
 */
export const GENCODE_RELEASE = "47";
export const GENE_TRACK_VARIANT: "basic" | "comprehensive" = "comprehensive";

/**
 * "full" gives every transcript its own row, which is what you want with the
 * comprehensive set. "merged" collapses them onto one row - compact, but hides
 * isoform structure. "tagged" colors by the tags listed in GENE_TAG_COLORS.
 */
export const GENE_TRACK_DISPLAY: "full" | "merged" | "tagged" = "full";
export const GENE_TRACK_HEIGHT = 220;

/** Optional: highlight transcripts whose name matches, e.g. "HNF1A". */
export const HIGHLIGHT_GENE: string | undefined = undefined;
export const HIGHLIGHT_COLOR = "#1f77b4";

/** Color MANE Select (canonical) transcripts so they stand out. */
export const GENE_TAG_COLORS = [{ tag: "MANE_Select", color: "#d45c2f" }];

const BASE = "https://users.wenglab.org/andrewsg/browser";

export type SignalTrack = {
  id: string;
  title: string;
  url: string;
  color?: string;
  height?: number;
  /** Fix the y-axis so samples are visually comparable. Omit to autoscale. */
  yRange?: { min: number; max: number };
};

/** bigWig coverage tracks. */
export const SIGNAL_TRACKS: SignalTrack[] = [
  {
    id: "sample-1",
    title: "Sample 1 (control, rep 1)",
    url: `${BASE}/ENCFF113VII.bigWig`,
    color: "#2266aa",
    height: 60,
    yRange: { min: 0, max: 5 },
  },
];

export type BamTrack = {
  id: string;
  title: string;
  /** The index is assumed to be <bamUrl>.bai unless baiUrl is given. */
  bamUrl: string;
  baiUrl?: string;
  height?: number;
  /**
   * "coverage" | "pileup" | "both" | "sashimi". Coverage is always drawn;
   * reads and junction arcs appear below it once you zoom past their own
   * (tighter) thresholds.
   */
  display?: "coverage" | "pileup" | "both" | "sashimi";
  /**
   * Zoom gates in bp. Everything is computed from the alignments in view, so
   * these bound how many reads the tab has to hold at once. Raise them only if
   * your BAMs aren't deeply covered.
   *
   * They measure the RENDER window, which the browser overscans to 3x the
   * visible span so panning stays smooth. A 100,000 gate therefore starts
   * drawing at a visible width of about 33,000 bp. The gate bounds the read
   * volume, and the overscan is part of that volume, so it is deliberately the
   * larger span that is measured.
   */
  coverageMaxBases?: number;
  maxBases?: number;
  sashimiMaxBases?: number;
};

/**
 * BAM tracks. Coverage, read pileup, and sashimi junction arcs are all derived
 * live from the alignments - no precomputed signal or junction files.
 */
export const BAM_TRACKS: BamTrack[] = [
  {
    id: "hepg2-rna-bam",
    title: "HepG2 RNA-seq (ENCFF660EXG)",
    bamUrl: `${BASE}/ENCFF660EXG.bam`,
    height: 180,
    display: "sashimi",
    coverageMaxBases: 100000,
    maxBases: 20000,
    sashimiMaxBases: 100000,
  },
];

export type DynseqTrack = {
  id: string;
  title: string;
  /** Per-base scores: phyloP, model contribution/importance, ... */
  bigwigUrl: string;
  /** Genome sequence, used for the nucleotide letters when zoomed in. */
  twoBitUrl?: string;
  height?: number;
};

/** Genome 2bit shared by the dynseq tracks below. */
export const TWO_BIT_URL = `${BASE}/hg38.2bit`;

/**
 * dynseq tracks: a filled signal when zoomed out, colored nucleotide letters
 * scaled by score when zoomed in.
 */
export const DYNSEQ_TRACKS: DynseqTrack[] = [
  {
    id: "dynseq-chrombpnet",
    title: "ChromBPNet contribution (ENCFF829DSC)",
    bigwigUrl: `${BASE}/ENCFF829DSC.bigWig`,
    height: 110,
  },
  {
    id: "dynseq-phylop",
    title: "Zoonomia phyloP (QC)",
    bigwigUrl: "https://users.wenglab.org/andrewsg/241-mammalian-2020v2.bigWig",
    height: 100,
  },
];
