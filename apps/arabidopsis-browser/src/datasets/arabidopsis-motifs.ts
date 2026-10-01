import { tair10 } from "@weng-lab/genomebrowser";
import type { BamTrack, BigBedTrack, Dataset, DynseqTrack, SignalTrack } from "./types";

/**
 * Arabidopsis thaliana, TAIR10: gradient attributions and discovered motifs for
 * the BOTANIC fine-tuned ATAC model.
 *
 * Model: BiMamba2 backbone cherry_idx26, full fine-tune F2, ChromBPNet-style
 * count and profile heads, 2,114 bp input and 1,000 bp output. Trained on ATAC
 * SRX8571616, which `arabidopsis.ts` also carries as a signal track. Splits are
 * by chromosome: train 1/3/5, validation 2, **test 4**.
 *
 * Only the central 1 kb of each window is scored, so bases outside every scored
 * window carry no value at all - the tracks are sparse by construction, not
 * broken. `coverage.bw` says how many windows cover a base; where they overlap
 * the value is their mean.
 *
 * Provenance: the pipeline writes RefSeq accessions (NC_003070.9 ...). These
 * files were relabelled to TAIR names, which is a pure rename - the source
 * lengths matched `tair10` exactly, so no coordinate moved. The bigWigs went
 * through fixedStep wig at %.9g rather than bedGraph, and every one is
 * bit-exact against its source over all 63,393,278 covered bases. The BigBeds
 * convert back to byte-identical BED. See PROVENANCE.txt beside the data.
 */
export const ASSEMBLY = tair10;

const BASE = "https://storage.googleapis.com/living-models-browser-data/arabidopsis";
const MOTIFS = `${BASE}/motif-discovery`;

/**
 * A promoter-proximal G-box, chosen so the opening view shows every track with
 * something in it.
 *
 * The hit is at Chr4:10,141,621-10,141,631 on TTCACGTGTT, FiNeMo coefficient
 * 37.8 and similarity 0.95. It sits ~630 bp upstream of the AT4G18350 TSS,
 * inside scored window `test:peaks:1880` - chromosome 4 is the held-out test
 * split, so this is the model calling a motif on sequence it never trained on.
 *
 * The bounds are not arbitrary. They cover a scored window completely, which
 * matters because attribution is only defined inside one: a wider view puts
 * gaps in every gradient track, and a view tight to the window itself loses
 * the gene. This is the span that keeps both.
 *
 * Chr4:9,755,776-9,758,786 holds the single strongest G-box in the library
 * (coefficient 55.4) if you want that instead, but it is intergenic and only
 * partly covered, so two tracks there render empty.
 */
export const INITIAL_REGION = "Chr4:10141060-10142500";

export const SHOW_GENE_TRACK = true;

/** As in `arabidopsis.ts`: the packaged GENCODE catalog has no TAIR10. */
export const GENCODE_RELEASE = "";
export const GENE_TRACK_VARIANT: "basic" | "comprehensive" = "comprehensive";
export const GENE_TRACK_URL: string | undefined = `${BASE}/tair10.bb`;
export const GENE_TRACK_TITLE: string | undefined = "Araport11 / Ensembl Plants TAIR10.63";
export const GENE_TRACK_DISPLAY: "full" | "merged" | "tagged" = "full";
export const GENE_TRACK_HEIGHT = 140;

export const HIGHLIGHT_GENE: string | undefined = undefined;
export const HIGHLIGHT_COLOR = "#1f77b4";
export const GENE_TAG_COLORS = [{ tag: "Ensembl_canonical", color: "#d45c2f" }];

export const TWO_BIT_URL = `${BASE}/tair10.2bit`;

/**
 * Attribution at the reference base, drawn as nucleotides scaled by their score
 * once you zoom in far enough to see letters.
 *
 * Read the signs carefully, because only one track's sign means what you would
 * assume. `count` is the gradient of predicted log1p total reads, so positive
 * really is "more predicted reads". `profile` and `combined` describe
 * redistribution *within* the window, so their signs say where signal moves,
 * not whether there is more of it.
 *
 * These are first-order gradients, not ISM: they compress strong effects by
 * roughly threefold and can miss weak ones entirely. phyloP is kept alongside
 * deliberately - it is the one track here that does not come from the model, so
 * a contribution peak sitting on conserved bases is corroboration rather than a
 * restatement of the same model's opinion.
 *
 * Not included: the twelve grad_*_hyp_{A,C,G,T}.bw files, which hold the
 * per-base values for all four bases. They are uploaded beside these, but the
 * dynseq module takes a single signal and draws the *reference* base, so a
 * stacked four-base logo needs a module that accepts four bigWigs. Adding one
 * is the only thing standing between these files and real logos.
 *
 * The `cbp-*` tracks are a **second, independent model** on the same data, and
 * the comparison is the point of having both:
 *
 *   BOTANIC (grad-*)   BiMamba2 backbone, first-order gradients
 *   ChromBPNet (cbp-*) CNN with an explicit Tn5 bias model, DeepSHAP
 *
 * Both were interpreted over the same 30,965 MACS3 peaks of the same ATAC
 * sample, SRX8571616, so they are comparable region for region. Where they
 * agree on a motif, that is two architectures and two attribution methods
 * concurring; where only one fires, suspect the method before the biology.
 *
 * ChromBPNet's are bias-corrected, from chrombpnet_nobias.h5: Tn5 insertion
 * preference is modelled separately and removed, so what is left is sequence
 * driving accessibility rather than the enzyme's own sequence taste. The
 * uncorrected pair exists in the pipeline (`_withbias`) and is not uploaded;
 * it is mainly useful for checking the bias model did something.
 *
 * DeepSHAP and first-order gradients are not on the same scale and should not
 * be compared by height - the BOTANIC README notes its gradients compress
 * strong effects about threefold. Compare *where* they put importance.
 */
export const DYNSEQ_TRACKS: DynseqTrack[] = [
  {
    id: "grad-count-contrib",
    title: "Attribution, count head (more / fewer predicted reads)",
    url: `${MOTIFS}/grad_count_contrib.bw`,
    height: 110,
  },
  {
    id: "grad-profile-contrib",
    title: "Attribution, profile head (redistribution within window)",
    url: `${MOTIFS}/grad_profile_contrib.bw`,
    height: 110,
  },
  {
    id: "grad-combined-contrib",
    title: "Attribution, combined (Stouffer of count + profile)",
    url: `${MOTIFS}/grad_combined_contrib.bw`,
    height: 110,
  },
  {
    id: "cbp-counts-contrib",
    title: "ChromBPNet attribution, counts head (DeepSHAP, bias-corrected)",
    url: `${MOTIFS}/cbp_counts_contrib.bw`,
    height: 110,
  },
  {
    id: "cbp-profile-contrib",
    title: "ChromBPNet attribution, profile head (DeepSHAP, bias-corrected)",
    url: `${MOTIFS}/cbp_profile_contrib.bw`,
    height: 110,
  },
  {
    id: "phylop-brassicales",
    title: "phyloP, 18-species Brassicales (PlantRegMap) - independent evidence",
    url: `${BASE}/phylop-brassicales18.bw`,
    height: 100,
  },
];

/**
 * What each model predicts, what it was measured against, and how many scored
 * windows back each base.
 *
 * **Read each prediction against its own observed track, not the other one.**
 * The two observed tracks are the same ATAC library processed differently -
 * Pearson r 0.989 over a sample window, but not equal: BOTANIC trained on raw
 * insertion counts from its shard, ChromBPNet on the +4/-4 shifted unstranded
 * signal, and totals differ by around a sixth. They are deliberately adjacent
 * so the pairing is visible rather than implied.
 *
 * Neither observed track is the +4/-5 CPM-normalised insertion signal that also
 * exists in the ChromBPNet pipeline, which would line up subtly wrong; the one
 * here was checked against the pipeline's own chrombpnet_signal output and has
 * identical min, max and mean.
 *
 * ChromBPNet's prediction is bias-corrected, so it is what the model believes
 * the sequence implies with Tn5 preference removed. It will not track observed
 * signal base for base at that level of detail, and should not.
 *
 * BOTANIC's prediction covers all 88,249 windows, train and val included, so
 * most of what you see it has seen. Chromosome 4 is the held-out test split and
 * the only honest place to judge it: predicted against observed log1p counts
 * there is Pearson r 0.750 on peaks and 0.657 on background, against 0.914 on
 * training peaks. Those three numbers are recomputed from the window bigBed
 * below rather than quoted.
 *
 * `coverage` is worth leaving on: it is the difference between "the model
 * assigned this base no importance" and "no window scored this base at all",
 * which the attribution tracks alone cannot distinguish. Note it describes the
 * BOTANIC windows; the ChromBPNet tracks cover the peak set instead, which is
 * why their extents differ.
 */
export const SIGNAL_TRACKS: SignalTrack[] = [
  {
    id: "botanic-pred",
    title: "BOTANIC predicted ATAC signal",
    url: `${MOTIFS}/botanic1s_atac_predicted_signal.bw`,
    color: "#1f6fb4",
    height: 60,
  },
  {
    id: "botanic-obs",
    title: "BOTANIC observed ATAC - raw insertion counts, what it was trained against",
    url: `${MOTIFS}/botanic1s_atac_observed_signal.bw`,
    color: "#4a4a4a",
    height: 60,
  },
  {
    id: "cbp-pred-nobias",
    title: "ChromBPNet predicted signal, bias-corrected (SRX8571616)",
    url: `${MOTIFS}/cbp_pred_nobias.bw`,
    color: "#c2185b",
    height: 60,
  },
  {
    id: "atac-srx8571616",
    title: "ChromBPNet observed ATAC (SRX8571616) - +4/-4 unstranded, what it was trained against",
    url: `${BASE}/atac-SRX8571616.bw`,
    color: "#6d7f1f",
    height: 60,
  },
  {
    id: "window-coverage",
    title: "Scored windows covering each base",
    url: `${MOTIFS}/coverage.bw`,
    color: "#8a8a8a",
    height: 34,
    yRange: { min: 0, max: 3 },
  },
];

/**
 * Motif calls. Note the ordering: seqlets are what TF-MoDISco actually clustered,
 * FiNeMo hits are those patterns scanned back across every peak, so the hits are
 * the larger and noisier set by construction.
 *
 * **The FiNeMo tracks are pre-filtered at hit_similarity >= 0.9 and this matters
 * more than it sounds.** The module has no field filter, so a threshold cannot
 * be set here - it has to be baked into the file. Unfiltered, only 20% of
 * G-box-family hits sit on an actual CACGTG; at 0.9 that is 96%, at the cost of
 * keeping 18% of the hits. The unfiltered files are uploaded as
 * finemo_{count,combined}_hits.bb if you want to see what is being discarded.
 *
 * Names are `family|act-or-sup|pattern`. "act"/"sup" is the TF-MoDISco positive
 * or negative metacluster, and family labels are rule-based: core consensus plus
 * the best JASPAR 2024 plants Tomtom match, so treat them as a hint rather than
 * an assignment.
 */
export const BIGBED_TRACKS: BigBedTrack[] = [
  {
    id: "modisco-count-seqlets",
    title: "TF-MoDISco seqlets, count head (50 bp windows)",
    url: `${MOTIFS}/modisco_count_seqlets.bb`,
    bedSchema: "bed6",
    display: "squish",
    color: "#2a6f9e",
    height: 46,
  },
  {
    id: "modisco-profile-seqlets",
    title: "TF-MoDISco seqlets, profile head (50 bp windows)",
    url: `${MOTIFS}/modisco_profile_seqlets.bb`,
    bedSchema: "bed6",
    display: "squish",
    color: "#2a6f9e",
    height: 46,
  },
  {
    id: "modisco-combined-seqlets",
    title: "TF-MoDISco seqlets, combined (50 bp windows)",
    url: `${MOTIFS}/modisco_combined_seqlets.bb`,
    bedSchema: "bed6",
    display: "squish",
    color: "#2a6f9e",
    height: 46,
  },
  {
    id: "finemo-count-hits",
    title: "FiNeMo hits, count head (hit_similarity >= 0.9)",
    url: `${MOTIFS}/finemo_count_hits_sim0.9.bb`,
    bedSchema: "bed6",
    display: "squish",
    color: "#a8432a",
    height: 46,
  },
  {
    id: "finemo-combined-hits",
    title: "FiNeMo hits, combined (hit_similarity >= 0.9)",
    url: `${MOTIFS}/finemo_combined_hits_sim0.9.bb`,
    bedSchema: "bed6",
    display: "squish",
    color: "#a8432a",
    height: 46,
  },
  {
    id: "botanic-window-counts",
    title: "BOTANIC per-window predicted vs observed log1p counts (score = 100 x predicted)",
    url: `${MOTIFS}/botanic1s_atac_window_counts.bb`,
    bedSchema: "bed6",
    display: "dense",
    color: "#1f6fb4",
    height: 22,
  },
  {
    id: "scored-windows",
    title: "Scored windows (name = split:peaks|background:row)",
    url: `${MOTIFS}/windows.bb`,
    bedSchema: "bed4",
    display: "dense",
    color: "#9a9a9a",
    height: 20,
  },
];

/** No alignments here; `arabidopsis.ts` carries the RNA-seq BAM. */
export const BAM_TRACKS: BamTrack[] = [];

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
