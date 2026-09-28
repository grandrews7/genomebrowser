# Working in this fork

Fork of `weng-lab/genomebrowser`. Read [AGENTS.md](AGENTS.md) first: it is the
upstream maintainer guidance and still applies in full. This file covers only
what the fork adds, which upstream's docs do not mention.

## What the fork carries that upstream does not

The BAM and dynseq work has all landed upstream, so `packages/` now tracks
`weng-lab/genomebrowser` rather than carrying its own copies:

| Contribution                    | Outcome                                            |
| ------------------------------- | -------------------------------------------------- |
| dynseq track module             | merged as #264                                      |
| BAM/BAI reading                 | #263 adapted into Nishi's #267, merged              |
| coverage and junction sections  | Jair built them in #293 after review of #267        |
| range byte cache                | #306, open                                          |

What remains fork-only is the app in `apps/rnaseq-browser/` and this file.
Resolve any future `packages/` conflict in upstream's favour; the fork has no
package changes worth preserving except while a PR like #306 is in flight.

The published `2.0.0` packages predate all of it, and the fork carries the same
version number, so a plain `npm install` silently resolves to a build without
`./bam` or `./dynseq` and nothing warns you. Consuming these from another
project means packing tarballs; `apps/rnaseq-browser/DEPLOY.md` has the recipe.

Keep PR branches free of anything app-specific - upstream asked for no Living
Models content in them. `git add -A` from the repository root has swept a
Firebase deploy cache into a PR once; stage deliberately.

## The app

`apps/rnaseq-browser` is a Vite SPA deployed to Firebase Hosting as the Living
Models Genome Browser. Its data lives in a public GCS bucket and is **never**
part of the build - `public/` is gitignored for that reason, and once made the
bundle 197 MB instead of 800 KB.

Adding a dataset is one file plus one line, and nothing else:

1. Copy `src/datasets/hepg2.ts` (human, uses the packaged GENCODE catalog) or
   `src/datasets/arabidopsis.ts` (non-human, supplies its own annotation).
2. Point it at your files.
3. Name it in `src/config.ts`: `export * from "./datasets/<name>";`

`Dataset` in `src/datasets/types.ts` is enforced with `satisfies`, so a missing
or misspelled field is a compile error rather than a silently empty track.

For hg38 and mm10, leave `GENE_TRACK_URL` undefined and the packaged GENCODE
catalog supplies gene models. Every other assembly needs its own BigGenePred
bigBed; `apps/rnaseq-browser/DEPLOY.md` documents how the TAIR10 one was built.

## Four things that fail quietly

These cost real time in this repo, and none of them produce an error:

- **Chromosome naming.** A file naming the same sequences differently renders an
  *empty track, not an error*, because panning onto an unknown contig is normal.
  Four conventions appear in this project's source data: TAIR (`Chr1`), Ensembl
  Plants (`1`), RefSeq (`NC_003070.9`), and UCSC (`chr1`). Check names against
  the assembly before assuming a track is broken.
- **Organelles that share a name but not an assembly.** RefSeq's Arabidopsis
  mitochondrion is 367,808 bp; TAIR10's `ChrM` is 366,924. Renaming one to the
  other yields coordinates that line up with nothing. Compare lengths, not names.
- **Transfer encoding.** `Content-Encoding: gzip` breaks the range requests that
  bigWig, bigBed and BAM depend on. Verify with
  `curl -I <url> | grep stored-content-encoding` that it says `identity`.
- **`maxWindow` is the render window**, which the browser overscans to 3x the
  visible span (`PAN_OVERSCAN_MULTIPLIER`). A 30,000 gate starts drawing at
  about 10,000 bp visible. The same trap applies to any zoom gate read from
  `demand.region` in a fetcher, which is already overscanned; `visibleRegion` is
  only available to renderers.

## Verifying

`pnpm verify` is the workspace check. Per package:

```sh
pnpm --filter @weng-lab/genomic-reader     typecheck && ... test -- --run
pnpm --filter @weng-lab/genomebrowser-tracks typecheck && ... test -- --run
pnpm --filter @weng-lab/rnaseq-browser     typecheck
```

Editing a package and then reading it back through a built artifact needs
`pnpm --filter <pkg> build` first, or typecheck compares against a stale `dist`
and reports confusing missing-property errors.

When changing reader performance, measure rather than reason: fetch a real BAM
over a real network and record requests, bytes and wall clock. Every performance
change in this fork was driven by a measurement that contradicted the obvious
explanation, and record counts were verified unchanged before and after.

## Deploying

```sh
pnpm --filter @weng-lab/rnaseq-browser build
cd apps/rnaseq-browser && firebase deploy --only hosting
```

Live at <https://living-models-browser.web.app>. Full procedure, cache headers,
bucket layout and the data-preparation recipes are in
[apps/rnaseq-browser/DEPLOY.md](apps/rnaseq-browser/DEPLOY.md).

After deploying, confirm the served bundle hash matches the one just built
rather than trusting the deploy output: Firebase defaults HTML to
`max-age=3600`, and a stale `index.html` has twice been mistaken here for a
broken build.
