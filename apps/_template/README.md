# Browser template

A starting point for a new genome browser. Copy the directory, write a dataset
file, and you have an app.

It runs as-is: hg38 with gene models from the packaged GENCODE catalog, nothing
to host. Two views are wired so the dataset picker is visible; a project with
one view simply lists one, and the picker hides itself.

## Starting a project

```sh
cp -R apps/_template apps/my-browser
```

Then four small edits, none of them in the app's logic:

1. **`package.json`** — change `name`.
2. **`src/branding.ts`** — the title, and a logo if you have one.
3. **`src/datasets/`** — copy `example.ts`, point it at your data, delete the
   examples you do not need.
4. **`src/config.ts`** — list your datasets.

```sh
pnpm install
pnpm --filter <your-package-name> dev
```

Nothing else needs changing. `App.tsx`, `datasets/types.ts`, `index.css` and
`vite.config.ts` carry no project-specific content, which is what makes copying
the directory a reasonable way to start.

## Starting a project outside this repository

The copy above assumes `apps/`, because the template reaches the packages
through the workspace: `workspace:*` dependencies, Vite aliases, and tsconfig
paths, all pointing at `../../packages`. Lifted out of the repository, all
three break.

For a separate repository, take the packages as tarballs instead. `dist` is
gitignored and there is no `prepare` script, so installing from GitHub gives a
package with no build output; `pnpm pack` runs `prepack`, which builds the
chain:

```sh
# in this repository
mkdir -p ~/tarballs
for p in @weng-lab/genomebrowser @weng-lab/genomebrowser-tracks @weng-lab/genomic-reader; do
  pnpm --filter "$p" pack --pack-destination ~/tarballs
done
```

Then copy the template out and make three changes:

1. **`package.json`** - point the three `@weng-lab` packages at
   `file:../tarballs/<name>.tgz`, and replace every `catalog:` version with a
   real one. `catalog:` is a pnpm workspace feature and means nothing outside.
2. **`vite.config.ts`** - delete the workspace aliases. The packages come from
   `node_modules` now. Keep the `dedupe`, which is what stops a second React
   copy throwing "Invalid hook call" from inside a track.
3. **`tsconfig.json`** - delete the `paths` block, for the same reason.

Then `npm install` and it runs. Verified: the result builds and renders gene
models with a working dataset picker, outside the workspace entirely.

The cost is that the packages become a pinned snapshot - re-pack to pick up
changes. A project you are co-developing with the packages belongs in `apps/`;
one that consumes a stable version does not have to.

## What you get

|                 |                                                                                |
| --------------- | ------------------------------------------------------------------------------ |
| Signal          | bigWig, with optional fixed y-range                                            |
| Genes           | packaged GENCODE for hg38 and mm10, or your own BigGenePred BigBed             |
| Alignments      | BAM with coverage, splice junctions and a read pileup, each toggled on its own |
| Per-base scores | dynseq - a filled signal that becomes scaled nucleotide letters when zoomed in |
| Intervals       | BigBed features                                                                |
| Switching       | a picker that swaps the track list while keeping the region                    |

`Dataset` in [`src/datasets/types.ts`](src/datasets/types.ts) is the contract,
enforced with `satisfies`, so a missing or misspelled field is a compile error
rather than a silently empty track.

## Things that fail quietly

None of these produce an error, and all of them have cost time on this repo:

- **Chromosome names must match the assembly exactly.** A file naming the same
  sequences differently renders an _empty track, not an error_, because panning
  onto an unknown contig is normal. `chr1`, `1`, `Chr1` and `NC_003070.9` are
  four conventions for one sequence.
- **Hosting needs CORS and HTTP range requests.** These formats read slices,
  never whole files. `Content-Encoding: gzip` breaks ranges outright; check with
  `curl -I <url> | grep stored-content-encoding` that it says `identity`. Files
  in `public/`, referenced as `/my-sample.bw`, avoid all of this.
- **`maxWindow` is the render window**, which the browser overscans to 3x the
  visible span. A 30,000 gate starts drawing at about 10,000 bp visible.
- **Every dataset must share one assembly.** A second genome needs a second
  browser store. `App.tsx` throws on load naming the offenders.

## Deploying

`firebase.json` is included with the cache headers that matter - `index.html`
must stay `no-cache`, or a deploy takes up to an hour to reach anyone who has
already loaded the page. Add a `.firebaserc` naming your own Firebase project:

```json
{ "projects": { "default": "your-project-id" } }
```

```sh
pnpm --filter <your-package-name> build
cd apps/my-browser && firebase deploy --only hosting
```

Hosting the data is a separate matter; `apps/arabidopsis-browser/DEPLOY.md` has
a worked example, including building an annotation for an assembly the GENCODE
catalog does not cover.
