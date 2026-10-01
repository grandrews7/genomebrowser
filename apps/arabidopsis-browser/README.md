# Arabidopsis Browser

A Vite single-page app for looking at a locus across assays: bigWig signal,
gene annotation, BAM alignments with coverage and splice junctions, and
per-base dynseq scores. Every track module comes from `packages/tracks`; the
app is configuration and layout.

Each dataset lives in [`src/datasets`](src/datasets) and owns its assembly,
starting region, gene-track settings, and track lists. [`src/config.ts`](src/config.ts)
lists the ones the browser offers, and a picker in the header switches between
them at runtime:

```ts
export const DATASETS: DatasetOption[] = [
  { id: "assays", label: "Assay panel", dataset: arabidopsis },
  { id: "motifs", label: "Attributions and motifs", dataset: arabidopsisMotifs },
];
export const DEFAULT_DATASET_ID = "motifs";
```

Switching keeps the region you are looking at, which is the point - the same
locus under a different set of evidence. That works because the picker replaces
the track list through the track store's `setTracks` rather than rebuilding the
stores, so the browser store, and the region it holds, survive the switch.

Every dataset in the list must share one assembly. The browser store binds its
assembly at creation and normalises regions against it, so a second assembly
needs a second store; `App.tsx` throws on load naming the offenders rather than
quietly reinterpreting coordinates.

Two are shipped, both TAIR10 with their own annotation built from an Ensembl
GTF, and every file served from a public bucket, so a fresh clone renders
without any local data:

- `datasets/arabidopsis.ts` - the assay panel: RNA-seq signal and alignments,
  phyloP, and fifteen ATAC samples.
- `datasets/arabidopsis-motifs.ts` - gradient attributions and discovered
  motifs for the BOTANIC fine-tuned ATAC model, as dynseq and bigBed tracks.
  The one the browser opens on.

It is also the harder of the two cases to copy. An hg38 or mm10 dataset needs
no annotation of its own - leave `GENE_TRACK_URL` undefined and the packaged
GENCODE catalog supplies gene models, making `GENCODE_RELEASE` and
`GENE_TRACK_VARIANT` the only settings that matter. Every other assembly has to
build a BigGenePred bigBed, which `DEPLOY.md` documents for TAIR10.

To use local files instead, drop them in `public/` and reference them as
`/my-sample.bw`. That sidesteps CORS entirely, and `public/` is gitignored
apart from its own `.gitignore`, so data never reaches the repository.

To add one, copy it, point it at your files, and name it in
`config.ts`. `Dataset` in [`datasets/types.ts`](src/datasets/types.ts) is the
contract each file satisfies, so a missing member is a compile error rather than
an empty track. Everything else is wiring.

## Track modules

The BAM and dynseq modules are no longer app-local. They live in
`packages/tracks` and are imported like any other first-party track:

```ts
import { bamModule } from "@weng-lab/genomebrowser-tracks/bam";
import { dynseqModule } from "@weng-lab/genomebrowser-tracks/dynseq";
```

| Module   | Displays                          | What it draws                                                                                                                                     |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bam`    | `dense`, `squish`, `pack`, `full` | Coverage, junction arcs and stacked reads. `display` sets the read layout; coverage and junctions are sections above it, each toggled on its own. |
| `dynseq` | `full`                            | Per-base scores as a filled signal, becoming scaled nucleotide letters when zoomed in.                                                            |

BAM reading is in `@weng-lab/genomic-reader` as `createBamFile`, so the app has
no BAM-specific dependency of its own. Both are upstream now: the dynseq track merged as weng-lab/genomebrowser#264,
the BAM reader was adapted into #267, and #293 rebuilt the BAM track around
coverage, junction and alignment sections. This fork tracks that work rather
than carrying its own copy.

## Reading BAM in a browser

Coverage, pileup, and arcs all come from materializing every alignment in the
window, so `maxWindow` in the dataset bounds it. It measures the **render**
window, which the browser overscans to 3x the visible span: a 30,000 gate starts
drawing at about 10,000 bp visible.

Window size is a poor proxy for cost, though. What a fetch pays for is bytes,
and a highly expressed gene breaks the relationship in both directions:
Arabidopsis RBCS1A holds 456,000 reads inside 1,500 bp, while an intergenic
window of the same width costs almost as much because the index resolves it to
similarly fragmented chunks.

The reader caches the compressed bytes it has read, bounded per file, so panning
inside a region already fetched issues no requests at all.

Junction counts are **view-local**: only reads inside the fetched window are
tallied, so a count can change as you pan. They also carry no annotated/novel
flag, no unique-vs-multi split, and no splice-site motif, all of which need the
aligner's own splice output and a GTF rather than the alignments alone.

A note on MAPQ: STAR writes 255 for a uniquely mapped read, which the SAM spec
reserves for "unavailable". Leave `minMappingQuality` at 0 for STAR output;
filtering on it behaves in the opposite way to what you would expect.

## Running it

From the repo root:

```sh
pnpm install
pnpm --filter @living-models/arabidopsis-browser dev
```

The workspace packages resolve to their TypeScript sources (see the aliases in
`vite.config.ts` and the paths in `tsconfig.json`), so package edits show up in
the dev server without building them first.
