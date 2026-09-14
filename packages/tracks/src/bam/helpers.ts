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

/** Placement for one junction arc and its count label. */
export type JunctionArc = {
  junction: BamJunction;
  x1: number;
  x2: number;
  midX: number;
  /** Quadratic control point. The drawn curve peaks half way towards it. */
  controlY: number;
  /** Highest point the drawn curve actually reaches. */
  peakY: number;
  strokeWidth: number;
  /** False when the label would collide with one already placed. */
  showLabel: boolean;
};

const ARC_MIN_HEIGHT = 8;
const ARC_LABEL_GAP = 3;
const LABEL_LINE_HEIGHT = 11;
/** Advance width of a digit at the 10px label size, with a little slack. */
const LABEL_DIGIT_WIDTH = 6.5;

/**
 * Places junction arcs and decides which counts can be labelled.
 *
 * Arc height scales with span, so a long-range junction rises above a short
 * one instead of every arc sharing a single apex. That is the usual sashimi
 * convention, and it also spreads the labels apart. Labels sit at the curve's
 * real peak - half way to the quadratic control point, not at the control point
 * itself, which is above anything the curve reaches.
 *
 * Even so, a dense view has more junctions than legible labels, so labels are
 * placed highest-count first and any that would overlap one already placed is
 * dropped. The arc is always drawn; only its number is omitted, and the tooltip
 * still reports the count.
 */
export function layoutJunctionArcs(
  junctions: readonly BamJunction[],
  options: { region: { start: number; end: number }; width: number; height: number },
): JunctionArc[] {
  const { region, width, height } = options;
  const bases = Math.max(1, region.end - region.start);
  const toX = (position: number) => ((position - region.start) / bases) * width;
  const baseline = height - 2;
  const maxArcHeight = Math.max(ARC_MIN_HEIGHT, height - LABEL_LINE_HEIGHT - ARC_LABEL_GAP - 2);

  let peakCount = 1;
  let widestSpan = 0;
  for (const junction of junctions) {
    if (junction.count > peakCount) peakCount = junction.count;
    const span = Math.abs(toX(junction.end) - toX(junction.start));
    if (span > widestSpan) widestSpan = span;
  }

  const arcs: JunctionArc[] = junctions.map((junction) => {
    const x1 = toX(junction.start);
    const x2 = toX(junction.end);
    // Square root keeps short junctions from collapsing flat onto the baseline
    // while still letting the widest one reach full height.
    const share = widestSpan > 0 ? Math.sqrt(Math.abs(x2 - x1) / widestSpan) : 1;
    const arcHeight = ARC_MIN_HEIGHT + (maxArcHeight - ARC_MIN_HEIGHT) * share;
    return {
      junction,
      x1,
      x2,
      midX: (x1 + x2) / 2,
      // Doubling puts the curve's own peak at arcHeight above the baseline.
      controlY: baseline - arcHeight * 2,
      peakY: baseline - arcHeight,
      // Thickness scales with the log of the count so a 500-read junction does
      // not render a 5-read one invisible.
      strokeWidth: 0.75 + (Math.log1p(junction.count) / Math.log1p(peakCount)) * 3.25,
      showLabel: false,
    };
  });

  const placed: { left: number; right: number; top: number; bottom: number }[] = [];
  for (const arc of [...arcs].sort((left, right) => right.junction.count - left.junction.count)) {
    const labelWidth = String(arc.junction.count).length * LABEL_DIGIT_WIDTH;
    const bottom = arc.peakY - ARC_LABEL_GAP;
    const box = {
      left: arc.midX - labelWidth / 2,
      right: arc.midX + labelWidth / 2,
      top: bottom - LABEL_LINE_HEIGHT,
      bottom,
    };
    if (box.top < 0) continue;
    const overlaps = placed.some(
      (other) =>
        box.left < other.right &&
        box.right > other.left &&
        box.top < other.bottom &&
        box.bottom > other.top,
    );
    if (overlaps) continue;
    placed.push(box);
    arc.showLabel = true;
  }

  return arcs;
}
