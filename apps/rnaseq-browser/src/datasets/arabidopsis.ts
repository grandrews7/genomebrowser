import { tair10 } from "@weng-lab/genomebrowser";
import type { BamTrack, Dataset, DynseqTrack, SignalTrack } from "./types";

/**
 * Arabidopsis thaliana, TAIR10.
 *
 * Both files below are served from a public Google Cloud Storage bucket with
 * CORS enabled, so anyone with the app URL can read them. They are stored
 * without transfer encoding, which matters: Content-Encoding would break the
 * range requests these formats depend on.
 *
 * Chromosome naming is the thing to watch. TAIR and Araport call them Chr1..Chr5,
 * ChrM and ChrC, which is what the `tair10` preset declares and what the files
 * here use. Ensembl Plants instead calls them 1..5, Mt and Pt, so an Ensembl
 * file will silently render empty against this assembly. The annotation below
 * was converted from Ensembl and renamed to match; see the note on building it.
 */

/** Chr1..Chr5, ChrM, ChrC. Lengths match this bigWig's own header exactly. */
export const ASSEMBLY = tair10;

/** FLC (AT5G10140) and its neighbours. */
export const INITIAL_REGION = "Chr5:3170000-3182000";

export const SHOW_GENE_TRACK = true;

/**
 * The packaged GENCODE catalog only covers hg38 and mm10, so TAIR10 supplies
 * its own annotation and the two settings below are unused.
 *
 * Built from the Ensembl Plants GTF with the repository's own converter:
 *
 *   curl -O https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/current/gtf/arabidopsis_thaliana/Arabidopsis_thaliana.TAIR10.63.gtf.gz
 *   gzcat Arabidopsis_thaliana.TAIR10.63.gtf.gz | awk 'BEGIN{FS=OFS="\t"}
 *     /^#/{print;next}
 *     {if($1=="Mt")$1="ChrM"; else if($1=="Pt")$1="ChrC"; else if($1~/^[1-5]$/)$1="Chr"$1; print}' > tair10.gtf
 *   cd tools/gtf-to-big-gene-pred-plus && cargo build --release
 *   ./target/release/gtf-to-big-gene-pred-plus tair10.gtf \
 *     --chrom-sizes tair10.chrom.sizes --output tair10.bb
 *
 * The awk step is the important one: it renames Ensembl's contigs to TAIR
 * convention so the annotation, the signal, and the assembly all agree. The
 * chrom.sizes file must use the same names.
 */
export const GENCODE_RELEASE = "";
export const GENE_TRACK_VARIANT: "basic" | "comprehensive" = "comprehensive";
export const GENE_TRACK_URL: string | undefined =
  "https://storage.googleapis.com/living-models-browser-data/arabidopsis/tair10.bb";
export const GENE_TRACK_TITLE: string | undefined = "Araport11 / Ensembl Plants TAIR10.63";

export const GENE_TRACK_DISPLAY: "full" | "merged" | "tagged" = "full";
export const GENE_TRACK_HEIGHT = 180;

export const HIGHLIGHT_GENE: string | undefined = undefined;
export const HIGHLIGHT_COLOR = "#1f77b4";

/** Ensembl's canonical-transcript tag, the equivalent of MANE Select in human. */
export const GENE_TAG_COLORS = [{ tag: "Ensembl_canonical", color: "#d45c2f" }];

/**
 * No dynseq tracks: they need a reference 2bit and per-base scores, and there
 * is no Arabidopsis phyloP equivalent to hand. Generate a 2bit with
 * `faToTwoBit TAIR10.fa tair10.2bit` if you add model attribution scores later.
 */
export const TWO_BIT_URL = "";
export const DYNSEQ_TRACKS: DynseqTrack[] = [];

/** log2 enrichment, so the signal is signed and centred near zero. */
export const SIGNAL_TRACKS: SignalTrack[] = [
  {
    id: "log2-cdna-over-input",
    title: "log2 cDNA / input",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/log2_cDNA_over_input.bw",
    color: "#2a7a2a",
    height: 90,
  },
];

/** No alignments yet; add a BAM and its .bai to ./public to see reads. */
export const BAM_TRACKS: BamTrack[] = [];

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
