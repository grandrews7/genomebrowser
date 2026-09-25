import type { TrackInteraction } from "@weng-lab/genomebrowser";
import type { BamRecord, TwoBitRecord } from "@weng-lab/genomic-reader";
import type { BamConfig } from "./schema";

export type BamDisplay = "coverage" | "sashimi" | "dense" | "squish" | "pack" | "full";

/** One splice junction and how many reads in view support it. */
export type BamJunction = { start: number; end: number; count: number };
export type BamData = {
  records: BamRecord[];
  reference: TwoBitRecord[];
  message?: string;
  referenceError?: string;
};
export type BamInteraction = TrackInteraction<BamRecord, BamConfig>;
export type { BamConfig } from "./schema";
export type { BamRecord } from "@weng-lab/genomic-reader";
