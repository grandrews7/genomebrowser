import { useInteraction, useTooltip, type TrackRendererProps } from "@weng-lab/genomebrowser";
import type { ReactNode } from "react";
import { packRows } from "../shared/layout";
import { condenseSignalRecords } from "../shared/signal";
import {
  computeCoverageRuns,
  computeJunctions,
  filterJunctions,
  layoutJunctionArcs,
  sampleReads,
} from "./helpers";
import type { BamConfig, BamData, BamInteractionTarget } from "./types";

type Props = TrackRendererProps<BamConfig, BamData>;

/** Fraction of the track the coverage band keeps when something sits below it. */
const COVERAGE_SHARE = 0.4;
const SECTION_GAP = 4;

function ZoomNotice({
  width,
  height,
  maxBases,
}: {
  width: number;
  height: number;
  maxBases: number;
}) {
  return (
    <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#999">
      Zoom in below {maxBases.toLocaleString("en-US")} bp to see alignments
    </text>
  );
}

function Coverage({
  data,
  region,
  width,
  height,
  color,
}: Pick<Props, "data" | "region" | "width" | "height"> & { color: string }) {
  // Reuse the shared condenser so coverage bins to pixels exactly the way a
  // BigWig signal track does, and the two read the same at a glance.
  const points = condenseSignalRecords(computeCoverageRuns(data, region), region, width);
  let peak = 0;
  for (const point of points) {
    if (point.max !== null && point.max > peak) peak = point.max;
  }
  if (peak === 0) return null;

  let path = `M 0 ${height}`;
  for (const point of points) {
    const value = point.max ?? 0;
    path += ` L ${point.x} ${(height - (value / peak) * height).toFixed(2)}`;
  }
  path += ` L ${width} ${height} Z`;

  return (
    <>
      <path d={path} fill={color} opacity={0.85} />
      <text x={2} y={10} fontSize={10} fill="#666">
        {peak.toLocaleString("en-US")}
      </text>
    </>
  );
}

function Pileup({
  data,
  region,
  width,
  height,
  config,
  color,
}: Pick<Props, "data" | "region" | "width" | "height" | "config" | "color">) {
  const interaction = useInteraction<BamInteractionTarget>();
  const tooltip = useTooltip<BamInteractionTarget, BamConfig>();
  const bases = region.end - region.start;
  const toX = (position: number) => ((position - region.start) / bases) * width;

  const drawn = sampleReads(data, config.maxReads);
  const rows = packRows(drawn, (record) => ({ start: record.start, end: record.end }), { gap: 1 });
  const rowHeight = Math.max(2, Math.min(10, (height - 2) / Math.max(1, rows.length)));
  const readHeight = Math.max(1, rowHeight - 1);

  return (
    <>
      {rows.map((row, rowIndex) =>
        row.map((record) => {
          const y = rowIndex * rowHeight;
          const fill = record.strand === "+" ? color : config.reverseStrandColor;
          const target: BamInteractionTarget = { kind: "alignment", alignment: record };
          let reference = record.start;
          const segments: ReactNode[] = [];

          record.cigar.forEach((segment, index) => {
            const { operation, length } = segment;
            if (operation === "M" || operation === "=" || operation === "X") {
              const x = toX(reference);
              const segmentWidth = Math.max(0.5, toX(reference + length) - x);
              segments.push(
                <rect
                  key={index}
                  x={x}
                  y={y}
                  width={segmentWidth}
                  height={readHeight}
                  fill={fill}
                />,
              );
              reference += length;
            } else if (operation === "N") {
              // The intron a spliced read crosses: a thin connector, not coverage.
              segments.push(
                <line
                  key={index}
                  x1={toX(reference)}
                  y1={y + readHeight / 2}
                  x2={toX(reference + length)}
                  y2={y + readHeight / 2}
                  stroke="#bbb"
                  strokeWidth={1}
                />,
              );
              reference += length;
            } else if (operation === "D") {
              reference += length;
            }
          });

          return (
            <g
              key={`${record.name}:${record.start}:${record.flag}`}
              style={{ cursor: "pointer" }}
              onClick={() => interaction?.onClick?.(target)}
              onMouseEnter={(event) => tooltip.show(target, event)}
              onMouseLeave={tooltip.hide}
            >
              {segments}
            </g>
          );
        }),
      )}
      {drawn.length < data.length && (
        <text x={2} y={height - 2} fontSize={10} fill="#999">
          showing {drawn.length.toLocaleString("en-US")} of {data.length.toLocaleString("en-US")}{" "}
          reads
        </text>
      )}
    </>
  );
}

function Sashimi({
  data,
  region,
  width,
  height,
  config,
  color,
}: Pick<Props, "data" | "region" | "width" | "height" | "config"> & { color: string }) {
  const interaction = useInteraction<BamInteractionTarget>();
  const tooltip = useTooltip<BamInteractionTarget, BamConfig>();

  const junctions = filterJunctions(computeJunctions(data), config);
  if (junctions.length === 0) return null;
  const arcs = layoutJunctionArcs(junctions, { region, width, height });

  return (
    <>
      {arcs.map((arc) => {
        const target: BamInteractionTarget = { kind: "junction", junction: arc.junction };
        return (
          <g
            key={`${arc.junction.start}:${arc.junction.end}`}
            style={{ cursor: "pointer" }}
            onClick={() => interaction?.onClick?.(target)}
            onMouseEnter={(event) => tooltip.show(target, event)}
            onMouseLeave={tooltip.hide}
          >
            <path
              d={`M ${arc.x1} ${height - 2} Q ${arc.midX} ${arc.controlY} ${arc.x2} ${height - 2}`}
              fill="none"
              stroke={color}
              strokeWidth={arc.strokeWidth}
              opacity={0.85}
            />
            {arc.showLabel && (
              <text x={arc.midX} y={arc.peakY - 3} textAnchor="middle" fontSize={10} fill={color}>
                {arc.junction.count}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

/** Coverage alone, filling the track. */
export function CoverageBam({ config, data, region, width, height }: Props) {
  if (region.end - region.start > config.maxBases) {
    return <ZoomNotice width={width} height={height} maxBases={config.maxBases} />;
  }
  return (
    <Coverage
      data={data}
      region={region}
      width={width}
      height={height}
      color={config.coverageColor}
    />
  );
}

/** Coverage above, with something drawn underneath it. */
function SplitBam({ props, children }: { props: Props; children: (height: number) => ReactNode }) {
  const { config, data, region, width, height } = props;
  if (region.end - region.start > config.maxBases) {
    return <ZoomNotice width={width} height={height} maxBases={config.maxBases} />;
  }

  const coverageHeight = Math.round(height * COVERAGE_SHARE);
  const lowerY = coverageHeight + SECTION_GAP;
  const lowerHeight = Math.max(1, height - lowerY);

  return (
    <>
      <Coverage
        data={data}
        region={region}
        width={width}
        height={coverageHeight}
        color={config.coverageColor}
      />
      <g transform={`translate(0, ${lowerY})`}>{children(lowerHeight)}</g>
    </>
  );
}

/** Coverage above stacked reads. */
export function PileupBam(props: Props) {
  return (
    <SplitBam props={props}>
      {(height) => (
        <Pileup
          data={props.data}
          region={props.region}
          width={props.width}
          height={height}
          config={props.config}
          color={props.color}
        />
      )}
    </SplitBam>
  );
}

/** Coverage above junction arcs. */
export function SashimiBam(props: Props) {
  return (
    <SplitBam props={props}>
      {(height) => (
        <Sashimi
          data={props.data}
          region={props.region}
          width={props.width}
          height={height}
          config={props.config}
          color={props.config.coverageColor}
        />
      )}
    </SplitBam>
  );
}
