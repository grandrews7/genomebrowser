# Salvia sclarea Browser

Gene models, short-read coverage and ONT long reads over _Salvia sclarea_ v3,
built around the sclareol question: what is trichome-specific, and what responds
to MeJA.

Created from [`apps/_template`](../_template); that README covers the parts
common to every browser here.

## Where the data comes from

Everything is aligned against `salvia_sclarea_v3_withOrg.fa`, and the reference,
its GTF and every track name contigs `Ss01`..`Ss11`, `Pt`, `Mt`. Nothing needs
renaming, which removes the usual cause of a silently empty track.

| Track               | Source                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Gene models         | `salvia_v3.bb`, built on HiPerGator from the pipeline's own GTF - the same file STAR and RSEM were given |
| Short-read coverage | 8 of 104 libraries from `/blue/jhernandezjarqui/andrewsg/salvia_rnaseq`, BPM normalised                  |
| ONT long reads      | SRA study SRP674096 (PRJNA1417963), realigned with `minimap2 -ax splice`                                 |

The assembly is defined in [`src/datasets/assembly.ts`](src/datasets/assembly.ts)
rather than in `packages/core`, taken verbatim from the reference `.fai`. Keeping
it in the app leaves `packages/` identical to upstream, so merging upstream stays
a fast-forward.

## Hosting, and why this does not deploy yet

The five ONT BAMs are hosted, because they are a reprocessing of published SRA
data. They live in `gs://living-models-browser-data/salvia/`.

The eight bigWigs are **not**. They are unpublished libraries, and the bucket is
world-readable and anonymously listable, so they are served from `./public`
instead - which works in `dev` and needs no hosting decision.

That is also why `pnpm build` is not useful here yet: a build copies `public/`
into `dist`, so it would publish those libraries as a side effect. Host them, or
drop them from the dataset, before deploying.

## Running it

```sh
pnpm install
pnpm --filter @living-models/salvia-browser dev
```

The gene models and the eight bigWigs expect files in `./public`, which is
gitignored. Rebuild the annotation with the recipe in
[`src/datasets/salvia.ts`](src/datasets/salvia.ts), and copy the bigWigs from
`results/bigwig` on the cluster.

## The tracks

Five ONT tissues each draw depth and counted splice junctions. Only the trichome
sample draws its reads as well: five pileups would bury everything else, and the
junction counts come from every read whether or not it is drawn. Turn the others
on from the gear if you want them.
