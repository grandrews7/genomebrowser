import type { TrackFetchContext } from "@weng-lab/genomebrowser";
import { readCachedBamRecords } from "../shared/cachedFiles";
import type { BamConfig, BamData } from "./types";

/**
 * Reads every alignment overlapping the render window.
 *
 * Coverage, pileup, and arcs are all derived from these records, so the only
 * bound on memory is the window itself - hence the `maxBases` gate, which
 * refuses the request rather than letting a wide view over a deeply covered
 * gene materialize hundreds of thousands of records. The gate measures the
 * overscanned render region, because that is what actually gets fetched.
 */
export async function fetchBam({
  track: { config },
  demand: { region },
  resources,
}: TrackFetchContext<BamConfig>): Promise<BamData> {
  if (region.end - region.start > config.maxBases) return [];

  const records = await readCachedBamRecords(resources, config.url, config.indexUrl, region);
  return config.minMappingQuality > 0
    ? records.filter((record) => record.mappingQuality >= config.minMappingQuality)
    : records;
}
