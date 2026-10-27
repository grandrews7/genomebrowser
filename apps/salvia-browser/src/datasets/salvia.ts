import type { BamTrack, BigBedTrack, Dataset, DynseqTrack, SignalTrack } from "./types";
import { salviaSclareaV3 } from "./assembly";

/**
 * Salvia sclarea v3: gene models, with RNA-seq coverage to follow.
 *
 * Everything here was produced by the pipeline at
 * /blue/jhernandezjarqui/andrewsg/salvia_rnaseq on HiPerGator, against
 * `ref/salvia_sclarea_v3_withOrg.fa`. The reference, its GTF and the coverage
 * bigWigs all name contigs Ss01..Ss11, Pt, Mt, so no renaming step stands
 * between the pipeline and the browser.
 */

export const ASSEMBLY = salviaSclareaV3;

/** Eight genes on Ss01, seven of them multi-exon, so the opening view has structure. */
export const INITIAL_REGION = "Ss01:1960000-2000000";

export const SHOW_GENE_TRACK = true;

/**
 * The packaged GENCODE catalog covers only hg38 and mm10, so this assembly
 * brings its own annotation and the two settings below are unused.
 *
 * Built on the cluster from the pipeline's own GTF - the same file STAR and
 * RSEM were given, so the browser cannot disagree with the quantification:
 *
 *   cut -f1,2 ref/salvia_sclarea_v3_withOrg.fa.fai > salvia.chrom.sizes
 *   gtf-to-big-gene-pred-plus ref/salvia_sclarea_v3_withOrg.gtf \
 *     --chrom-sizes salvia.chrom.sizes --output salvia_v3.bb
 *
 * The converter needs Rust 1.85 or newer for edition 2024; HiPerGator's newest
 * module is 1.62, so install a toolchain with `pixi global install rust`.
 */
export const GENCODE_RELEASE = "";
export const GENE_TRACK_VARIANT: "basic" | "comprehensive" = "comprehensive";
/*
 * Served from ./public rather than a bucket: this data is unpublished, and a
 * page-relative path needs no hosting decision, no CORS, and no upload. Drop
 * salvia_v3.bb there and it works; `public/` is gitignored, so the file never
 * reaches the repository. Swap in a URL once hosting is settled.
 */
export const GENE_TRACK_URL: string | undefined = "/salvia_v3.bb";
export const GENE_TRACK_TITLE: string | undefined = "Salvia sclarea v3 gene models";
export const GENE_TRACK_DISPLAY: "full" | "merged" | "tagged" = "full";
export const GENE_TRACK_HEIGHT = 180;

export const HIGHLIGHT_GENE: string | undefined = undefined;
export const HIGHLIGHT_COLOR = "#1f77b4";
export const GENE_TAG_COLORS: { tag: string; color: string }[] = [];

/** Only read by dynseq tracks, for nucleotide letters when zoomed in. */
export const TWO_BIT_URL = "/salvia_v3.2bit";

/**
 * Stranded coverage from the RNA-seq pipeline.
 *
 * 104 libraries exist in results/bigwig; a browser shows a handful legibly, so
 * list the contrasts worth looking at rather than the whole panel. They are BPM
 * normalised, which makes them comparable to each other without a fixed
 * `yRange`.
 */
/**
 * Short-read coverage, BPM normalised so the tracks compare without a fixed
 * yRange. Eight of the pipeline's 104 libraries: the trichome contrast that
 * sclareol turns on, the MeJA induction, and three tissues for specificity.
 *
 * Served from ./public because these libraries are unpublished. They work in
 * `dev` but would be copied into `dist` by a build, so hosting has to be
 * settled before this app is deployed.
 */
export const SIGNAL_TRACKS: SignalTrack[] = [
  {
    id: "rna-trichome",
    title: "RNA-seq trichome (DREV_TG)",
    url: "/DREV_TG.bpm.bw",
    color: "#8a4fbd",
    height: 42,
  },
  {
    id: "rna-calyx",
    title: "RNA-seq calyx (DREV_CM)",
    url: "/DREV_CM.bpm.bw",
    color: "#2a7a4a",
    height: 42,
  },
  {
    id: "rna-calyx-notrichome",
    title: "RNA-seq calyx, trichomes removed (DREV_CM_TG)",
    url: "/DREV_CM_TG.bpm.bw",
    color: "#6d9e52",
    height: 42,
  },
  {
    id: "rna-meja",
    title: "RNA-seq leaf, MeJA (MEJA_M1)",
    url: "/MEJA_M1.bpm.bw",
    color: "#c4642a",
    height: 42,
  },
  {
    id: "rna-water",
    title: "RNA-seq leaf, water (MEJA_H2)",
    url: "/MEJA_H2.bpm.bw",
    color: "#b59a3c",
    height: 42,
  },
  {
    id: "rna-leaf",
    title: "RNA-seq leaf (DREV_aF)",
    url: "/DREV_aF.bpm.bw",
    color: "#3b7fb5",
    height: 42,
  },
  {
    id: "rna-root",
    title: "RNA-seq root (DREV_aR)",
    url: "/DREV_aR.bpm.bw",
    color: "#8a6b4a",
    height: 42,
  },
  {
    id: "rna-bud",
    title: "RNA-seq bud (DREV_B)",
    url: "/DREV_B.bpm.bw",
    color: "#b5527a",
    height: 42,
  },
];

/**
 * ONT long reads, all five tissues, from SRA study SRP674096 (PRJNA1417963,
 * Dong et al., Nat Commun 2026) realigned with `minimap2 -ax splice`.
 *
 * Published data, so unlike the bigWigs above these are hosted rather than
 * local. Each shows depth and counted splice junctions; only the trichome
 * sample draws its reads as well, because five pileups would bury everything
 * else and the junction counts already come from every read.
 */
const ONT = "https://storage.googleapis.com/living-models-browser-data/salvia";

export const BAM_TRACKS: BamTrack[] = [
  {
    id: "ont-trichome",
    title: "ONT long-read, trichome",
    url: `${ONT}/trichome.bam`,
    height: 260,
    showCoverage: true,
    showJunctions: true,
    coverageHeight: 60,
    junctionHeight: 80,
    showAlignments: true,
    display: "squish",
    maxAlignmentRows: 30,
    maxWindow: 60000,
    maxJunctionSpan: 100000,
  },
  {
    id: "ont-calyx",
    title: "ONT long-read, calyx",
    url: `${ONT}/calyx.bam`,
    height: 150,
    showCoverage: true,
    showJunctions: true,
    coverageHeight: 60,
    junctionHeight: 80,
    showAlignments: false,
    maxWindow: 60000,
    maxJunctionSpan: 100000,
  },
  {
    id: "ont-leaf",
    title: "ONT long-read, leaf",
    url: `${ONT}/leaf.bam`,
    height: 150,
    showCoverage: true,
    showJunctions: true,
    coverageHeight: 60,
    junctionHeight: 80,
    showAlignments: false,
    maxWindow: 60000,
    maxJunctionSpan: 100000,
  },
  {
    id: "ont-flower",
    title: "ONT long-read, flower",
    url: `${ONT}/flower.bam`,
    height: 150,
    showCoverage: true,
    showJunctions: true,
    coverageHeight: 60,
    junctionHeight: 80,
    showAlignments: false,
    maxWindow: 60000,
    maxJunctionSpan: 100000,
  },
  {
    id: "ont-stem",
    title: "ONT long-read, stem",
    url: `${ONT}/stem.bam`,
    height: 150,
    showCoverage: true,
    showJunctions: true,
    coverageHeight: 60,
    junctionHeight: 80,
    showAlignments: false,
    maxWindow: 60000,
    maxJunctionSpan: 100000,
  },
];
export const DYNSEQ_TRACKS: DynseqTrack[] = [];
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
