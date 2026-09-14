import type { BigWigValueRecord } from "@weng-lab/genomic-reader";
import type { BamData, BamJunction } from "./types";

/**
 * Per-base depth over the region, emitted as runs of constant depth so the
 * shared signal condenser can bin it the same way it bins a BigWig.
 *
 * Depth is accumulated with a difference array: each aligned segment costs two
 * O(1) updates rather than one per base, so cost scales with the number of
 * CIGAR operations, not with total aligned bases. Every read is counted, so the
 * depth is exact. N and D advance the reference without adding depth.
 */
export function computeCoverageRuns(
  records: BamData,
  region: { chromosome: string; start: number; end: number },
): BigWigValueRecord[] {
  const span = region.end - region.start;
  if (span <= 0) return [];

  const deltas = new Map<number, number>();
  const bump = (position: number, amount: number) => {
    deltas.set(position, (deltas.get(position) ?? 0) + amount);
  };

  for (const record of records) {
    let reference = record.start;
    for (const segment of record.cigar) {
      const { operation, length } = segment;
      if (operation === "M" || operation === "=" || operation === "X") {
        const start = Math.max(reference, region.start);
        const end = Math.min(reference + length, region.end);
        if (end > start) {
          bump(start, 1);
          bump(end, -1);
        }
        reference += length;
      } else if (operation === "N" || operation === "D") {
        reference += length;
      }
    }
  }
  if (deltas.size === 0) return [];

  const boundaries = [...deltas.keys()].sort((left, right) => left - right);
  const runs: BigWigValueRecord[] = [];
  let depth = 0;
  for (let index = 0; index < boundaries.length; index++) {
    const start = boundaries[index]!;
    depth += deltas.get(start)!;
    const end = boundaries[index + 1] ?? region.end;
    if (depth <= 0 || end <= start) continue;

    // A boundary where reads start and stop in equal number leaves the depth
    // unchanged, so extend the previous run instead of emitting a second one at
    // the same value.
    const previous = runs.at(-1);
    if (previous && previous.end === start && previous.value === depth) {
      previous.end = end;
      continue;
    }
    runs.push({ kind: "value", chromosome: region.chromosome, start, end, value: depth });
  }
  return runs;
}

/**
 * Splice junctions tallied from the N operations of the reads in view.
 *
 * Counts are window-local: only reads inside the fetched region contribute, so
 * a count moves as the view moves. They are exact for what is on screen, not
 * genome-wide totals.
 */
export function computeJunctions(records: BamData): BamJunction[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    let reference = record.start;
    for (const segment of record.cigar) {
      const { operation, length } = segment;
      if (operation === "N") {
        const key = `${reference}:${reference + length}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        reference += length;
      } else if (operation === "M" || operation === "=" || operation === "X" || operation === "D") {
        reference += length;
      }
    }
  }

  const junctions: BamJunction[] = [];
  for (const [key, count] of counts) {
    const [start, end] = key.split(":");
    junctions.push({ start: Number(start), end: Number(end), count });
  }
  return junctions.sort((left, right) => left.start - right.start || left.end - right.end);
}

/** Junctions passing the configured read-count and span filters. */
export function filterJunctions(
  junctions: readonly BamJunction[],
  options: { minJunctionReads: number; maxJunctionSpan?: number },
): BamJunction[] {
  return junctions.filter((junction) => {
    if (junction.count < options.minJunctionReads) return false;
    const span = junction.end - junction.start;
    return options.maxJunctionSpan === undefined || span <= options.maxJunctionSpan;
  });
}

/**
 * Caps how many reads a pileup draws by sampling evenly across the window.
 * Records arrive sorted by start, so taking the first N would cluster every
 * drawn read on the left and leave the rest of the view empty.
 */
export function sampleReads(records: BamData, maxReads: number): BamData {
  if (records.length <= maxReads) return records;
  const stride = Math.ceil(records.length / maxReads);
  return records.filter((_, index) => index % stride === 0);
}
