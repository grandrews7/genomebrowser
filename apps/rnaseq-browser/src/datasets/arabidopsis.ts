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

/**
 * UBQ10 (AT4G05320), a plus-strand gene expressed highly enough to show clear
 * junctions without the read volume that makes RBCS1A impractical to fetch.
 */
export const INITIAL_REGION = "Chr4:2717500-2721000";

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
 * Every TAIR10 ATAC-seq sample in the collection, grouped by study: a tissue and
 * treatment panel (PRJNA1018553), untreated seedling replicates (PRJNA895400),
 * pollen vegetative and sperm cells (PRJNA682444), and siliques (PRJNA640237).
 * Replicates of one condition share a colour so the eye groups them.
 *
 * All were reprocessed to TAIR10 and rebuilt with TAIR chromosome names: the
 * pipeline's bigWigs label contigs with RefSeq accessions (NC_003070.9 and
 * friends), which name the same sequences at the same lengths but do not match
 * this assembly, so they would render empty tracks. See DEPLOY.md.
 *
 * Tracks are short, because fifteen of them at full height would not fit on a
 * screen. Raise `height` on the few you are comparing.
 */
export const SIGNAL_TRACKS: SignalTrack[] = [
  {
    id: "rnaseq-plus",
    title: "RNA-seq coverage, plus strand (SRX4488631)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/rnaseq-plus.bw",
    color: "#1f6fb4",
    height: 60,
  },
  {
    id: "rnaseq-minus",
    title: "RNA-seq coverage, minus strand (SRX4488631)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/rnaseq-minus.bw",
    color: "#b4431f",
    height: 60,
  },
  {
    id: "atac-srx21812610",
    title: "ATAC whole seedling, control (SRX21812610)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812610.bw",
    color: "#2a7a4a",
    height: 44,
  },
  {
    id: "atac-srx21812612",
    title: "ATAC whole seedling, ABA 4h (SRX21812612)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812612.bw",
    color: "#8a5bd0",
    height: 44,
  },
  {
    id: "atac-srx21812623",
    title: "ATAC root, ABA 4h rep1 (SRX21812623)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812623.bw",
    color: "#3f7fbf",
    height: 44,
  },
  {
    id: "atac-srx21812624",
    title: "ATAC root, ABA 4h rep2 (SRX21812624)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812624.bw",
    color: "#3f7fbf",
    height: 44,
  },
  {
    id: "atac-srx21812639",
    title: "ATAC mesophyll, ABA 4h (SRX21812639)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812639.bw",
    color: "#b5651d",
    height: 44,
  },
  {
    id: "atac-srx21812658",
    title: "ATAC guard cell, CO2 4h (SRX21812658)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX21812658.bw",
    color: "#0f8f8f",
    height: 44,
  },
  {
    id: "atac-srx18063716",
    title: "ATAC seedling, WT rep1 (SRX18063716)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX18063716.bw",
    color: "#2a7a4a",
    height: 44,
  },
  {
    id: "atac-srx18063718",
    title: "ATAC seedling, WT rep2 (SRX18063718)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX18063718.bw",
    color: "#2a7a4a",
    height: 44,
  },
  {
    id: "atac-srx9629755",
    title: "ATAC pollen, V-Mt VC rep1 (SRX9629755)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX9629755.bw",
    color: "#a33b7a",
    height: 44,
  },
  {
    id: "atac-srx9629756",
    title: "ATAC pollen, V-Mt VC rep2 (SRX9629756)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX9629756.bw",
    color: "#a33b7a",
    height: 44,
  },
  {
    id: "atac-srx14636807",
    title: "ATAC pollen, V-Mt VC rep4 (SRX14636807)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX14636807.bw",
    color: "#a33b7a",
    height: 44,
  },
  {
    id: "atac-srx9629757",
    title: "ATAC pollen, V-Mt SC rep1 (SRX9629757)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX9629757.bw",
    color: "#c2185b",
    height: 44,
  },
  {
    id: "atac-srx9629759",
    title: "ATAC pollen, WT VC rep1 (SRX9629759)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX9629759.bw",
    color: "#7b1fa2",
    height: 44,
  },
  {
    id: "atac-srx9629760",
    title: "ATAC pollen, WT VC rep2 (SRX9629760)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX9629760.bw",
    color: "#7b1fa2",
    height: 44,
  },
  {
    id: "atac-srx8571616",
    title: "ATAC siliques (SRX8571616)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX8571616.bw",
    color: "#6d7f1f",
    height: 44,
  },
];

/** No alignments yet; add a BAM and its .bai to ./public to see reads. */
/**
 * RNA-seq alignments, for coverage, read pileup, and splice-junction arcs.
 *
 * STAR output, so N operations mark introns and the sashimi display has
 * something to count. The file was reheadered from RefSeq accessions to TAIR
 * names before upload; the mitochondrion was left as NC_037304.1 rather than
 * renamed, because RefSeq's 367,808 bp assembly is not TAIR10's 366,924 bp
 * ChrM. It is therefore absent from this assembly and simply not reachable.
 *
 * `maxBases` bounds the window, but window size is a poor proxy for cost here:
 * what the fetch pays for is the number of alignments, and a highly expressed
 * gene breaks the relationship. RBCS1A holds 456,000 reads inside 1,500 bp,
 * roughly twenty times the whole UBQ10 window, so it stalls the fetch no matter
 * how tight the base gate is.
 *
 * Note on MAPQ: STAR writes 255 for a uniquely mapped read, which the SAM spec
 * reserves for "unavailable". 99.8% of reads here carry it, so a filter that
 * discards 255 as meaningless would discard nearly the whole library.
 * `minMappingQuality` is left at 0 for that reason.
 */
export const BAM_TRACKS: BamTrack[] = [
  {
    id: "rnaseq-bam",
    title: "RNA-seq alignments (SRX4488631)",
    url: "https://storage.googleapis.com/living-models-browser-data/arabidopsis/SRX4488631.bam",
    height: 300,
    display: "sashimi",
    maxBases: 30000,
    // Arabidopsis introns are short: the median is near 100 bp and few exceed a
    // couple of kb. Junctions spanning tens of kb are readthrough or
    // misalignment rather than splicing, and they flatten every real arc into
    // the baseline, so they are dropped.
    maxJunctionSpan: 10000,
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
