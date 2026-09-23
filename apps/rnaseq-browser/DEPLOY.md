# Deploying

The app is a static Vite build hosted on Firebase Hosting. The genomic data it
reads lives in a public Google Cloud Storage bucket and is **not** part of the
build - keep it that way. Putting data files under `public/` copies them into
`dist`, which is what once made the bundle 197 MB rather than the 800 KB it is.

Everything lives in one project, `living-models-browser`, on the Living Models
billing account.

## Deploy

```sh
pnpm --filter @weng-lab/rnaseq-browser build
cd apps/rnaseq-browser && firebase deploy --only hosting
```

Live at <https://living-models-browser.web.app>.

`firebase.json` rewrites every path to `index.html` so the single page handles
any URL, and sets the caching split that matters:

- `/assets/**` is immutable for a year. Safe, because Vite fingerprints those
  filenames with their contents.
- `index.html` is `no-cache`. **This is not optional.** Firebase defaults HTML
  to `max-age=3600`, so without it a deploy takes up to an hour to reach anyone
  who has already loaded the page, and they see the previous build with nothing
  to indicate it is stale.

If someone reports stale content, have them open `?v=2` (any query value) -
a different URL bypasses their cache - and confirm what the server is really
sending:

```sh
curl -sI https://living-models-browser.web.app | grep -i cache-control
```

## The data

```
gs://living-models-browser-data/arabidopsis/
```

The bucket is public with CORS allowing any origin, so the deployed app reads it
straight from the browser. Nothing else is served from the bucket; the app is
Firebase's job alone.

Two things matter when adding files:

- **Upload without transfer encoding.** `Content-Encoding: gzip` breaks the HTTP
  range requests that bigWig, bigBed and BAM all depend on, and these formats
  are already compressed internally. Check with
  `curl -I ... | grep stored-content-encoding` that it says `identity`.
- **Chromosome names must match the assembly exactly.** TAIR10 files here use
  `Chr1`..`Chr5`, `ChrM`, `ChrC`. A file naming the same sequences differently
  renders an empty track rather than an error, which is the least obvious way
  this goes wrong. Three conventions are in play across the source data: TAIR
  (`Chr1`), Ensembl Plants (`1`), and RefSeq (`NC_003070.9`).

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
