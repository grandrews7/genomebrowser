import { TrackTooltip, formatGenomicInterval } from "../shared/tooltips";
import type { BamInteractionTarget } from "./types";

export function BamTooltip({ item }: { item: BamInteractionTarget }) {
  if (item.kind === "junction") {
    const { junction } = item;
    return (
      <TrackTooltip
        title={`${junction.count.toLocaleString("en-US")} spanning reads`}
        rows={[
          { label: "Junction", value: formatGenomicInterval(junction.start, junction.end) },
          { label: "Span", value: `${(junction.end - junction.start).toLocaleString("en-US")} bp` },
          // Counts come from the reads in the fetched window, so say so rather
          // than letting a moving number look like a data error.
          { label: "Counted in", value: "the current view" },
        ]}
      />
    );
  }

  const { alignment } = item;
  return (
    <TrackTooltip
      title={alignment.name || "unnamed read"}
      rows={[
        { label: "Position", value: formatGenomicInterval(alignment.start, alignment.end) },
        { label: "Strand", value: alignment.strand },
        { label: "Mapping quality", value: String(alignment.mappingQuality) },
        {
          label: "CIGAR",
          value: alignment.cigar.map((segment) => `${segment.length}${segment.operation}`).join(""),
        },
        { label: "Flag", value: String(alignment.flag) },
      ]}
    />
  );
}
