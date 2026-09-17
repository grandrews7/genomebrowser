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
  /** The index is assumed to be <url>.bai unless this is given. */
  indexUrl?: string;
  height?: number;
  /**
   * "coverage" draws depth alone; "pileup" adds stacked reads below it;
   * "sashimi" adds splice-junction arcs below it.
   */
  display?: "coverage" | "pileup" | "sashimi";
  /**
   * Widest window, in bases, that will be fetched. Coverage, reads, and arcs
   * all come from holding every alignment in the window, so this bounds memory
   * rather than what is drawn.
   *
   * It measures the RENDER window, which the browser overscans to 3x the
   * visible span so panning stays smooth. A 100,000 gate therefore starts
   * drawing at a visible width of about 33,000 bp.
   */
  maxBases?: number;
  /** Drops alignments below this MAPQ. 0, the default, keeps multi-mappers. */
  minMappingQuality?: number;
  /** Hides junctions wider than this; useful at paralogous loci. */
  maxJunctionSpan?: number;
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
};
