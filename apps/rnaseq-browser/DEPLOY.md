# Deploying

The app is a static Vite build. The genomic data it reads lives in a public
Google Cloud Storage bucket and is **not** part of the build - keep it that way.
Putting data files under `public/` copies them into `dist`, which is what made
the bundle 197 MB rather than the 774 KB it is now.

Everything lives in one project (`living-models-browser`) on the Living Models
billing account.

## Current deployment: the bucket

Live at
<https://storage.googleapis.com/living-models-browser-data/app/index.html>.

One command, from this directory:

```sh
pnpm run deploy:bucket
```

That builds and uploads. It exists as a script because two details are easy to
get wrong by hand:

- **`--base=/living-models-browser-data/app/`.** A plain `vite build` writes
  root-relative asset paths like `/assets/index.js`, which resolve to the bucket
  root and 404. The base flag rewrites them to the bucket prefix.
- **`index.html` must not be cached.** The fingerprinted files under `assets/`
  are immutable and cache forever, but if `index.html` is cached, a redeploy
  never reaches anyone. The script sets `no-cache` on it after upload.

There is no single-page-app rewrite, so the URL needs the explicit
`/index.html`. That is fine here: one page, no routing.

## Nicer URL: Firebase Hosting

`firebase.json` and `.firebaserc` are ready, and the Firebase APIs are enabled
on the project, but `firebase projects:addfirebase living-models-browser`
returns 403 even for a project owner until the account has accepted Firebase's
terms. That happens once, in the console:

1. <https://console.firebase.google.com> → **Add project**
2. Choose the existing `living-models-browser` Google Cloud project
3. Accept the terms

After that:

```sh
pnpm --filter @weng-lab/rnaseq-browser build   # no --base; Firebase serves from the root
firebase deploy --only hosting
```

which publishes to `https://living-models-browser.web.app`. `firebase.json`
already rewrites every path to `index.html` and applies the same caching split.

Note the different build: Firebase serves from the domain root, so it wants the
default base, while the bucket needs the prefixed one.

## The data

```
gs://living-models-browser-data/arabidopsis/log2_cDNA_over_input.bw
gs://living-models-browser-data/arabidopsis/tair10.bb
```

The bucket is public with CORS allowing any origin, so the deployed app reads it
directly from the browser. Two things matter when adding files:

- **Upload without transfer encoding.** `Content-Encoding: gzip` breaks the HTTP
  range requests that bigWig, bigBed and BAM all depend on. These formats are
  already compressed internally, so there is nothing to gain. Check with
  `curl -I` that `x-goog-stored-content-encoding` is `identity`.
- **Chromosome names must match the assembly exactly.** TAIR10 files use
  `Chr1`..`Chr5`, `ChrM`, `ChrC`. An Ensembl Plants file calling them `1`..`5`
  renders an empty track rather than an error, which is the least obvious way
  this goes wrong.

```sh
gcloud storage cp yourfile.bw gs://living-models-browser-data/arabidopsis/
```

### Renaming contigs in an ATAC pipeline bigWig

The ChromBPNet inputs in `gs://greg-data/atac/chrombpnet_inputs/bigWig/` label
TAIR10 contigs with RefSeq accessions - `NC_003070.9` through `NC_003076.8` -
rather than `Chr1`..`Chr5`. Same sequences, same lengths, different names, so
they render an empty track against this assembly. Rebuild them first:

```sh
# UCSC tools, macOS arm64 builds
curl -O https://hgdownload.soe.ucsc.edu/admin/exe/macOSX.arm64/bigWigToBedGraph
curl -O https://hgdownload.soe.ucsc.edu/admin/exe/macOSX.arm64/bedGraphToBigWig
chmod +x bigWigToBedGraph bedGraphToBigWig

# gcloud's sliced download corrupts these files; stream instead
gcloud storage cat gs://greg-data/atac/chrombpnet_inputs/bigWig/SRX.bw \
  --project=dotomics-models > SRX.bw

./bigWigToBedGraph SRX.bw SRX.bg
awk 'BEGIN{FS=OFS="\t"
  m["NC_003070.9"]="Chr1"; m["NC_003071.7"]="Chr2"; m["NC_003074.8"]="Chr3"
  m["NC_003075.7"]="Chr4"; m["NC_003076.8"]="Chr5" }
  ($1 in m){ $1=m[$1]; print }' SRX.bg > SRX.renamed.bg
./bedGraphToBigWig SRX.renamed.bg tair10.chrom.sizes SRX-tair10.Chr.bw
```

`tair10.chrom.sizes` is the five nuclear chromosomes under TAIR names. The awk
filter drops any contig not in the map, so organelles present in one file and
absent from the sizes file cannot fail the rebuild.

The conversion is lossless: converting the rebuilt file back to bedGraph gives
a byte-identical result. It takes about six seconds per sample.

`sample_metadata.tsv` in that bucket maps every SRX to its tissue, treatment
and study, which is where the track titles come from.

Then add it to `src/datasets/arabidopsis.ts` and redeploy.
