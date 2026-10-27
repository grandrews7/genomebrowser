import type { AssemblyDefinition } from "@weng-lab/genomebrowser";

/**
 * The contract every dataset file satisfies.
 *
 * `src/config.ts` re-exports one dataset, so a file that omits a member fails
 * to compile at the point `App.tsx` imports it rather than rendering an empty
 * track. Keep this type and the dataset files in step.
 *
 * Notes on URLs, which apply to every track type below:
 *  - They must be reachable from the browser over HTTP(S).
 *  - The server must support HTTP Range requests: the browser reads only the
 *    slice of the file it needs, never the whole file.
 *  - A host other than this dev server must send permissive CORS headers,
 *    including Access-Control-Allow-Headers: range and
 *    Access-Control-Expose-Headers: content-range.
 *  - Local files: drop them in ./public and use "/my-sample.bw", which sidesteps
 *    CORS entirely.
 *  - Chromosome names must match the assembly exactly. "chr1" and "1" are
 *    different names, and a mismatch renders an empty track rather than an
 *    error, because panning onto an unknown contig is normal.
 */

export type SignalTrack = {
  id: string;
  title: string;
  url: string;
  color?: string;
  height?: number;
  /** Fix the y-axis so samples are visually comparable. Omit to autoscale. */
  yRange?: { min: number; max: number };
};

export type BamTrack = {
  id: string;
  title: string;
  url: string;
  /** Defaults to <url>.bai. */
  indexUrl?: string;
  height?: number;
  /**
   * How the reads themselves are laid out. Coverage and junctions are separate
   * sections stacked above them, toggled below, not display modes.
   */
  display?: "dense" | "squish" | "pack" | "full";
  /**
   * Widest window, in bases, that will be fetched. Every section comes from
   * holding the alignments in the window, so this bounds memory rather than
   * what is drawn.
   *
   * It measures the RENDER window, which the browser overscans to 3x the
   * visible span so panning stays smooth. A 30,000 gate therefore starts
   * drawing at a visible width of about 10,000 bp.
   */
  maxWindow?: number;
  /** Drops alignments below this MAPQ. 0, the default, keeps multi-mappers. */
  minMappingQuality?: number;

  /** Per-base depth. On by default. */
  showCoverage?: boolean;
  coverageHeight?: number;
  /** Splice-junction arcs, labelled with supporting read counts. Off by default. */
  showJunctions?: boolean;
  junctionHeight?: number;
  /** Junctions with fewer supporting reads than this are not drawn. */
  minJunctionSupport?: number;
  /** Hides junctions wider than this; useful where readthrough dominates. */
  maxJunctionSpan?: number;
  /** The read pileup itself. On by default. */
  showAlignments?: boolean;
  /**
   * Rows of reads to draw. A dense RNA-seq locus has far more than fit, and the
   * track says how many it left out. Coverage and junctions count every read
   * either way, so this trades pileup detail for vertical space.
   */
  maxAlignmentRows?: number;
  /**
   * Height of one read row. Read names are drawn only at 10 or more, and in
   * "squish" the row is halved, so either a squished display or a height below
   * 10 gives unlabelled bars.
   */
  alignmentRowHeight?: number;
};

export type BigBedTrack = {
  id: string;
  title: string;
  /** A BigBed of intervals: motif hits, seqlets, scored windows, ... */
  url: string;
  /**
   * How the positional columns are read. The module ships bed3..bed9 and ccre;
   * columns past the chosen schema are still carried on the row and shown in
   * the tooltip, they are just not typed. A bed6+3 file is therefore read as
   * "bed6" with its three extra columns along for the ride.
   */
  bedSchema?: "bed3" | "bed4" | "bed5" | "bed6" | "bed9" | "ccre";
  /** "squish" gives each row its own line; "dense" collapses them onto one. */
  display?: "dense" | "squish";
  color?: string;
  height?: number;
  rowHeight?: number;
};

export type DynseqTrack = {
  id: string;
  title: string;
  /** Per-base scores: phyloP, model contribution/importance, ... */
  url: string;
  /** Genome sequence, supplying the nucleotide letters when zoomed in. */
  twoBitUrl?: string;
  height?: number;
};

/**
 * Every member a dataset file must export. `satisfies Dataset` in a dataset
 * file checks the shape without widening the literal types the app relies on.
 */
export type Dataset = {
  ASSEMBLY: AssemblyDefinition;
  INITIAL_REGION: string;
  SHOW_GENE_TRACK: boolean;
  GENCODE_RELEASE: string;
  GENE_TRACK_VARIANT: "basic" | "comprehensive";
  /**
   * A BigGenePred BigBed to use instead of the packaged GENCODE catalog. Needed
   * for any assembly the catalog does not cover, which is everything except
   * hg38 and mm10. When set, GENCODE_RELEASE and GENE_TRACK_VARIANT are ignored.
   */
  GENE_TRACK_URL: string | undefined;
  /** Title for a custom annotation track. The catalog supplies its own. */
  GENE_TRACK_TITLE: string | undefined;
  GENE_TRACK_DISPLAY: "full" | "merged" | "tagged";
  GENE_TRACK_HEIGHT: number;
  HIGHLIGHT_GENE: string | undefined;
  HIGHLIGHT_COLOR: string;
  GENE_TAG_COLORS: { tag: string; color: string }[];
  TWO_BIT_URL: string;
  SIGNAL_TRACKS: SignalTrack[];
  BAM_TRACKS: BamTrack[];
  DYNSEQ_TRACKS: DynseqTrack[];
  BIGBED_TRACKS: BigBedTrack[];
};

/**
 * A dataset offered in the browser's dataset picker.
 *
 * Every option's `dataset.ASSEMBLY` must be the same, because the browser store
 * binds its assembly once at creation and normalises every region against it.
 * `App.tsx` checks this on load and throws naming the offenders, rather than
 * letting a mismatched option render a browser whose coordinates mean nothing.
 */
export type DatasetOption = {
  /** Stable key, used for the selector value. */
  id: string;
  /** What the selector shows. */
  label: string;
  dataset: Dataset;
};
