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

### Building the phyloP track and the 2bit

PlantRegMap publishes conservation as `Ath_PhyloP.bedGraph.gz`, per base over an
18-species Brassicales alignment, already using TAIR contig names - no renaming
needed, unlike everything else here.

```sh
gzcat Ath_PhyloP.bedGraph.gz > Ath_PhyloP.bedGraph          # 4.0 GB, 106.8M lines
./bedGraphToBigWig Ath_PhyloP.bedGraph tair10.full.chrom.sizes Ath_PhyloP.bw
```

`tair10.full.chrom.sizes` must include `ChrC` and `ChrM`, which the bedGraph
covers. Conversion takes about half a minute and yields 856 MB.

dynseq also needs a 2bit for its letters. The pipeline's `tair10.fa` uses RefSeq
names, so rewrite the headers first:

```sh
gcloud storage cat gs://greg-data/atac/resources/tair10/tair10.fa \
  --project=dotomics-models \
| awk 'BEGIN{ m["NC_003070.9"]="Chr1"; m["NC_003071.7"]="Chr2"; m["NC_003074.8"]="Chr3";
              m["NC_003075.7"]="Chr4"; m["NC_003076.8"]="Chr5"; m["NC_000932.1"]="ChrC" }
  /^>/ { id=substr($1,2); keep=(id in m); if(keep) print ">" m[id]; next }
  keep { print }' > tair10.Chr.fa
./faToTwoBit tair10.Chr.fa tair10.2bit
```

The mitochondrion is deliberately excluded. RefSeq's `NC_037304.1` is 367,808 bp
against TAIR10's `ChrM` at 366,924 - a different sequence, not a renaming - so
including it would misalign letters against any ChrM score. The five nuclear
chromosomes and `ChrC` match exactly.

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

### Renaming contigs in an RNA-seq BAM

The STAR output for SRX4488631 carries the same RefSeq accessions, and a BAM
header can be rewritten in place rather than rebuilt: `reheader` touches only the
header block, so a 1.1 GB file takes under two seconds. The index must be
regenerated afterwards, because changing the header length shifts every virtual
offset the old `.bai` recorded.

```sh
samtools reheader -c "sed \
  -e s/SN:NC_003070.9/SN:Chr1/ -e s/SN:NC_003071.7/SN:Chr2/ \
  -e s/SN:NC_003074.8/SN:Chr3/ -e s/SN:NC_003075.7/SN:Chr4/ \
  -e s/SN:NC_003076.8/SN:Chr5/ -e s/SN:NC_000932.1/SN:ChrC/" \
  Aligned.sortedByCoord.out.bam > SRX4488631.bam
samtools index -@ 4 SRX4488631.bam
```

`NC_037304.1` is deliberately not renamed. RefSeq's mitochondrion is 367,808 bp
and TAIR10's `ChrM` is 366,924, so they are different assemblies of the same
organelle; calling it `ChrM` would give a contig whose coordinates line up with
nothing else here. Left under its accession it is simply absent from the
assembly and unreachable, which is the honest outcome. Every other contig
matched TAIR10 lengths exactly, so those renames are safe.

The stranded bigWigs need the full bedGraph round trip as above, with `ChrC`
added to the map and `NC_037304.1` dropped.

### Uploading from the cluster

The BAM is 1.1 GB and a home upstream will not move that in reasonable time.
HiPerGator has `gcloud` under `/blue/jhernandezjarqui/andrewsg/pixi/bin` already
authenticated, so upload from there instead and skip the round trip through a
laptop: it sustains about 400 MiB/s.

Turn off parallel composite upload first. It splits the object into parts and
recombines them server-side, which leaves the result without an MD5 and is worth
avoiding for files served by range request:

```sh
gcloud config set storage/parallel_composite_upload_enabled False
```

All fifteen TAIR10 samples are converted and uploaded. After adding more, check
the two things that fail silently rather than erroring:

```sh
curl -sI -H "Range: bytes=0-63" \
  https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX.bw \
  | grep -iE "^HTTP/|stored-content-encoding"
```

expecting `206` and `identity`, and confirm the contig names in the served bytes
are `Chr1`..`Chr5` rather than RefSeq accessions.
