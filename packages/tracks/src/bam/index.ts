import { defineTrackModule, type ModuleCreateInput } from "@weng-lab/genomebrowser";
import type { BamRecord } from "@weng-lab/genomic-reader";
import { bamConfigSchema } from "./schema";
import { fetchBam } from "./fetch";
import { CoverageBam, DenseBam, FullBam, PackBam, SashimiBam, SquishBam } from "./render";
import { BamSettings } from "./settings";
import { BamTooltip } from "./tooltip";

export const bamModule = defineTrackModule<BamRecord>()({
  type: "bam",
  defaults: { display: "pack", height: 14, color: "#3366cc" },
  configSchema: bamConfigSchema,
  fetch: fetchBam,
  render: {
    coverage: CoverageBam,
    sashimi: SashimiBam,
    dense: DenseBam,
    squish: SquishBam,
    pack: PackBam,
    full: FullBam,
  },
  settingsComponent: BamSettings,
  tooltipComponent: BamTooltip,
});

export type BamCreateInput = ModuleCreateInput<typeof bamModule>;
export type {
  BamConfig,
  BamData,
  BamDisplay,
  BamInteraction,
  BamJunction,
  BamRecord,
} from "./types";
export { computeCoverageRuns, computeJunctions } from "./junctions";
