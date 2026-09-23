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
 * PlantRegMap phyloP over an 18-species Brassicales alignment, drawn as a
 * filled signal when zoomed out and as reference nucleotides scaled by their
 * score when zoomed in, negatives below the axis.
 *
 * Conservation is the independent evidence here: it comes from outside this
 * project's own models, so a peak sitting on conserved bases is an argument
 * rather than a restatement. Model predictions and contribution scores belong
 * alongside it as separate tracks, not as a substitute.
 *
 * The 2bit supplies the letters. It is built from the pipeline's TAIR10 fasta
 * with its RefSeq contig names rewritten to TAIR convention, minus the
 * mitochondrion: RefSeq's NC_037304.1 is 367,808 bp against TAIR10's 366,924,
 * a genuinely different sequence, so it is left out rather than misaligned.
 */
export const TWO_BIT_URL =
  "https://storage.googleapis.com/living-models-browser-data/arabidopsis/tair10.2bit";

export const DYNSEQ_TRACKS: DynseqTrack[] = [
  {
    id: "phylop-brassicales",
    title: "phyloP, 18-species Brassicales (PlantRegMap)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/phylop-brassicales18.bw",
    height: 110,
  },
];

/**
 * ATAC-seq accessibility, whole seedling, control versus 4 hours of ABA
 * (PRJNA1018553). Reprocessed to TAIR10 and rebuilt with TAIR chromosome names:
 * the pipeline's bigWigs label the contigs with RefSeq accessions
 * (NC_003070.9 and friends), which name the same sequences at the same lengths
 * but do not match this assembly, so they would render an empty track.
 */
export const SIGNAL_TRACKS: SignalTrack[] = [
  {
    id: "atac-seedling-control",
    title: "ATAC seedling, control (SRX21812610)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812610.bw",
    color: "#2a7a2a",
    height: 80,
  },
  {
    id: "atac-seedling-aba",
    title: "ATAC seedling, ABA 4h (SRX21812612)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812612.bw",
    color: "#8a5bd0",
    height: 80,
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
