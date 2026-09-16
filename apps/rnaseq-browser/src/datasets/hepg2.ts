import { hg38 } from "@weng-lab/genomebrowser";
import type { BamTrack, Dataset, DynseqTrack, SignalTrack } from "./types";

/**
 * HepG2 multi-omic panel at HNF1A: RNA-seq coverage and splice junctions,
 * ChromBPNet contribution scores, and Zoonomia phyloP for comparison.
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

/** Genome 2bit shared by the dynseq tracks below. */
export const TWO_BIT_URL = `${BASE}/hg38.2bit`;

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

/**
 * BAM tracks. Coverage, read pileup, and sashimi junction arcs are all derived
 * live from the alignments - no precomputed signal or junction files.
 */
export const BAM_TRACKS: BamTrack[] = [
  {
    id: "hepg2-rna-bam",
    title: "HepG2 RNA-seq (ENCFF660EXG)",
    url: `${BASE}/ENCFF660EXG.bam`,
    height: 180,
    display: "sashimi",
    maxBases: 100000,
    minMappingQuality: 1,
    maxJunctionSpan: 30000,
  },
];

/**
 * dynseq tracks: a filled signal when zoomed out, colored nucleotide letters
 * scaled by score when zoomed in.
 */
export const DYNSEQ_TRACKS: DynseqTrack[] = [
  {
    id: "dynseq-chrombpnet",
    title: "ChromBPNet contribution (ENCFF829DSC)",
    url: `${BASE}/ENCFF829DSC.bigWig`,
    height: 110,
  },
  {
    id: "dynseq-phylop",
    title: "Zoonomia phyloP (QC)",
    url: "https://users.wenglab.org/andrewsg/241-mammalian-2020v2.bigWig",
    height: 100,
  },
];

/** Fails to compile if anything above is missing or the wrong shape. */
const dataset = {
  ASSEMBLY,
  INITIAL_REGION,
  SHOW_GENE_TRACK,
  GENCODE_RELEASE,
  GENE_TRACK_VARIANT,
  GENE_TRACK_DISPLAY,
  GENE_TRACK_HEIGHT,
  HIGHLIGHT_GENE,
  HIGHLIGHT_COLOR,
  GENE_TAG_COLORS,
  TWO_BIT_URL,
  SIGNAL_TRACKS,
  BAM_TRACKS,
  DYNSEQ_TRACKS,
} satisfies Dataset;
void dataset;
