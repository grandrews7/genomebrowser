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

## App-local track modules

| Module                                                       | What it draws                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [`src/tracks/bamModule.tsx`](src/tracks/bamModule.tsx)       | Coverage, read pileup, and sashimi junction arcs, all derived live from BAM CIGARs.    |
| [`src/tracks/dynseqModule.tsx`](src/tracks/dynseqModule.tsx) | Per-base scores as a filled signal, becoming scaled nucleotide letters when zoomed in. |

They are app modules, not published API. Promote one into
`packages/tracks` only if it earns a place in the curated first-party set.

Both build their settings form out of `@weng-lab/genomebrowser-tracks/shared`,
so they get the same MUI layout as the first-party tracks and, more to the
point, the same deferred commits: a URL or a zoom gate applies when you set it,
not on every keystroke, which matters because those fields are marked
`fetchOnChange` and each commit costs a BAM read.

## The BAM reader

`@weng-lab/genomic-reader` has no BAM reader, so `bamModule` is the one place
that still depends on the legacy unscoped `genomic-reader` (1.4.10, axios-based)
for `BamReader`. That package was written for Node and checks
`response.data instanceof Buffer`, which is why [`src/polyfills.ts`](src/polyfills.ts)
installs a `Buffer` global and `vite.config.ts` defines `global`. Everything
else - bigWig and 2bit - uses `@weng-lab/genomic-reader`.

BAM is expensive to read in the browser: coverage, pileup, and arcs all come
from materializing every alignment in the window. Each view has its own zoom
gate in `src/config.ts`; past the widest one the fetcher returns nothing and the
track says so rather than trying.

Junction counts from BAM are **view-local**: only reads inside the fetched
window are tallied, so a count can change as you pan. They also carry no
annotated/novel flag, no unique-vs-multi split, and no splice-site motif, all of
which need STAR's `SJ.out.tab` and a GTF rather than the alignments alone.

## Running it

From the repo root:

```sh
pnpm install
pnpm --filter @weng-lab/rnaseq-browser dev
```

The workspace packages resolve to their TypeScript sources (see the aliases in
`vite.config.ts` and the paths in `tsconfig.json`), so package edits show up in
the dev server without building them first.
