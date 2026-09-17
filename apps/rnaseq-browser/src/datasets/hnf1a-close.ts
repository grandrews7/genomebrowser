import { hg38 } from "@weng-lab/genomebrowser";
import type { BamTrack, Dataset, DynseqTrack, SignalTrack } from "./types";

/**
 * The same HepG2 files as ./hepg2, opened at 200 bp inside HNF1A.
 *
 * At this width dynseq draws nucleotides rather than a filled signal, and the
 * ChromBPNet contribution scores resolve a CAATGTAAACA motif against the
 * reference sequence. The BAM opens as a read pileup, since junction arcs need
 * a wider window to be worth looking at.
 *
 * It is also the smallest example of a second dataset file: only the starting
 * region and two display choices differ from ./hepg2.
 */

export const ASSEMBLY = hg38;
export const INITIAL_REGION = "chr12:120978540-120978740";

export const SHOW_GENE_TRACK = true;
export const GENCODE_RELEASE = "47";
export const GENE_TRACK_VARIANT: "basic" | "comprehensive" = "comprehensive";
/** Undefined means "use the packaged GENCODE catalog". */
export const GENE_TRACK_URL: string | undefined = undefined;
export const GENE_TRACK_TITLE: string | undefined = undefined;

export const GENE_TRACK_DISPLAY: "full" | "merged" | "tagged" = "full";
export const GENE_TRACK_HEIGHT = 220;
export const HIGHLIGHT_GENE: string | undefined = undefined;
export const HIGHLIGHT_COLOR = "#1f77b4";
export const GENE_TAG_COLORS = [{ tag: "MANE_Select", color: "#d45c2f" }];

const BASE = "https://users.wenglab.org/andrewsg/browser";
export const TWO_BIT_URL = `${BASE}/hg38.2bit`;

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

export const BAM_TRACKS: BamTrack[] = [
  {
    id: "hepg2-rna-bam",
    title: "HepG2 RNA-seq (ENCFF660EXG)",
    url: `${BASE}/ENCFF660EXG.bam`,
    height: 180,
    display: "pileup",
    maxBases: 100000,
    minMappingQuality: 1,
  },
];

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
} satisfies Dataset;
void dataset;
