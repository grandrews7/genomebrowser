# RNA-seq Browser

A Vite single-page app for looking at RNA-seq over a locus: bigWig coverage,
GENCODE annotation, and two track modules that live in this app rather than in
`packages/tracks`.

Each dataset lives in [`src/datasets`](src/datasets) and owns its assembly,
starting region, gene-track settings, and track lists. [`src/config.ts`](src/config.ts)
names the active one, so switching between datasets is a single line:

```ts
export * from "./datasets/hepg2";
```

`datasets/arabidopsis.ts` is the non-human example: TAIR10, its own annotation
built from an Ensembl GTF, and files served from `public/`. `public/` is
gitignored apart from its own `.gitignore`, so drop local data there without it
reaching the repository. The committed default is `hepg2`, whose files are
hosted, so a fresh clone renders without any local data.

To add one, copy `datasets/hepg2.ts`, point it at your files, and name it in
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

| Module   | Displays                        | What it draws                                                                          |
| -------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `bam`    | `coverage`, `pileup`, `sashimi` | Depth, stacked reads, and junction arcs, all derived live from the alignments.         |
| `dynseq` | `full`                          | Per-base scores as a filled signal, becoming scaled nucleotide letters when zoomed in. |

BAM reading is in `@weng-lab/genomic-reader` as `createBamFile`, so the app has
no BAM-specific dependency of its own. Neither module is in the published
2.0.0 packages yet; both are open upstream as weng-lab/genomebrowser#263 and
\#264, so this fork's build is the only place they exist. That matters if you
consume the packages from another project - see the note in `DEPLOY.md`.

## Reading BAM in a browser

Coverage, pileup, and arcs all come from materializing every alignment in the
window, so `maxBases` in the dataset bounds it. It measures the **render**
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
pnpm --filter @weng-lab/rnaseq-browser dev
```

The workspace packages resolve to their TypeScript sources (see the aliases in
`vite.config.ts` and the paths in `tsconfig.json`), so package edits show up in
the dev server without building them first.
