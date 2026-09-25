import {
  useInteraction,
  useTooltip,
  type GenomicRegion,
  type TrackRendererProps,
} from "@weng-lab/genomebrowser";
import type { BamRecord, TwoBitRecord } from "@weng-lab/genomic-reader";
import { createGenomicXScale } from "../shared/coordinates";
import { useRowLayout } from "../shared/layout";
import { condenseSignalRecords } from "../shared/signal";
import {
  computeCoverageRuns,
  computeJunctions,
  filterJunctions,
  includeBamRecord,
  layoutJunctionArcs,
} from "./junctions";
import { darkenBamColor, layoutBam } from "./layout";
import type { BamConfig, BamData, BamDisplay } from "./types";

type Props = TrackRendererProps<BamConfig, BamData>;
export function DenseBam(props: Props) {
  return <BamRenderer {...props} display="dense" />;
}
export function SquishBam(props: Props) {
  return <BamRenderer {...props} display="squish" />;
}
export function PackBam(props: Props) {
  return <BamRenderer {...props} display="pack" />;
}
export function FullBam(props: Props) {
  return <BamRenderer {...props} display="full" />;
}
export function CoverageBam(props: Props) {
  return <AggregateBam {...props} mode="coverage" />;
}
export function SashimiBam(props: Props) {
  return <AggregateBam {...props} mode="sashimi" />;
}

/** Fraction of the track the coverage band keeps when arcs sit below it. */
const COVERAGE_SHARE = 0.4;
const SECTION_GAP = 4;

/**
 * Depth and splice junctions, aggregated over every read in view.
 *
 * These are the two views that answer "how much signal is here" and "which
 * splice forms are present", neither of which can be read off a pileup by eye.
 * Both share the pileup's read filter so the three displays agree about which
 * alignments exist.
 */
function AggregateBam({
  config,
  data,
  region,
  visibleRegion,
  width,
  height,
  mode,
}: Props & { mode: "coverage" | "sashimi" }) {
  const zoomRequired = visibleRegion.end - visibleRegion.start >= config.maxWindow;
  const status = (zoomRequired ? "Zoom in to see BAM track" : undefined) ?? data.message;
  const records = zoomRequired
    ? []
    : data.records.filter((record) => includeBamRecord(record, config));
  const x = createGenomicXScale(region, width);

  const coverageHeight = mode === "sashimi" ? Math.round(height * COVERAGE_SHARE) : height;
  const arcsY = coverageHeight + SECTION_GAP;
  const arcsHeight = Math.max(1, height - arcsY);

  return (
    <g data-bam-display={mode}>
      <rect width={width} height={height} fill="transparent" pointerEvents="none" />
      {status && (
        <text x={Math.max(0, x(visibleRegion.start)) + 4} y={11} fontSize={11} fill="#475569">
          {status}
        </text>
      )}
      <Coverage
        records={records}
        region={region}
        width={width}
        height={coverageHeight}
        color={config.coverageColor}
      />
      {mode === "sashimi" && (
        <g transform={`translate(0, ${arcsY})`}>
          <Junctions
            records={records}
            config={config}
            region={region}
            width={width}
            height={arcsHeight}
            color={config.coverageColor}
          />
        </g>
      )}
    </g>
  );
}

function Coverage({
  records,
  region,
  width,
  height,
  color,
}: {
  records: BamRecord[];
  region: GenomicRegion;
  width: number;
  height: number;
  color: string;
}) {
  // Reuse the shared condenser so depth bins to pixels exactly the way a BigWig
  // signal track does, and the two read the same at a glance.
  const points = condenseSignalRecords(computeCoverageRuns(records, region), region, width);
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

function Junctions({
  records,
  config,
  region,
  width,
  height,
  color,
}: {
  records: BamRecord[];
  config: BamConfig;
  region: GenomicRegion;
  width: number;
  height: number;
  color: string;
}) {
  const junctions = filterJunctions(computeJunctions(records), config);
  if (junctions.length === 0) return null;
  // Long reads routinely splice past both edges of the fetched region, so drop
  // the arcs that would be drawn entirely off the canvas rather than emit them.
  const arcs = layoutJunctionArcs(junctions, { region, width, height }).filter(
    (arc) => arc.x2 >= 0 && arc.x1 <= width,
  );

  return (
    <>
      {arcs.map((arc) => (
        <g key={`${arc.junction.start}:${arc.junction.end}`} data-junction={arc.junction.count}>
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
      ))}
    </>
  );
}

function BamRenderer({
  id,
  config,
  color,
  data,
  region,
  visibleRegion,
  width,
  display,
}: Props & { display: BamDisplay }) {
  const zoomRequired = visibleRegion.end - visibleRegion.start >= config.maxWindow;
  const layout = layoutBam(
    zoomRequired ? [] : data.records,
    config,
    display,
    region,
    visibleRegion,
    width,
  );
  const status =
    (zoomRequired ? "Zoom in to see BAM track" : undefined) ??
    data.message ??
    (data.referenceError
      ? "Reference unavailable; showing CIGAR-defined mismatches only."
      : undefined);
  // Status text gets its own row; even compact displays reserve readable height for it.
  const statusRows = status ? Math.ceil(14 / layout.rowHeight) : 0;
  const { rowHeight, trackHeight } = useRowLayout(id, layout.visibleRowCount + statusRows, {
    rowHeight: layout.rowHeight,
  });
  const x = createGenomicXScale(region, width);
  const interaction = useInteraction<BamRecord>();
  const tooltip = useTooltip<BamRecord, BamConfig>();
  const pixelsPerBase = width / (region.end - region.start);
  const showBases =
    (display === "pack" || display === "full") &&
    visibleRegion.end - visibleRegion.start <= config.sequenceMaxWindow &&
    rowHeight >= 10;
  return (
    <g data-bam-display={display}>
      <rect width={width} height={trackHeight} fill="transparent" pointerEvents="none" />
      {status && (
        <text x={Math.max(0, x(visibleRegion.start)) + 4} y={11} fontSize={11} fill="#475569">
          {status}
        </text>
      )}
      {layout.rows.map((row, rowIndex) => (
        <g
          key={rowIndex}
          data-bam-row={rowIndex}
          transform={`translate(0,${(rowIndex + statusRows) * rowHeight})`}
        >
          {row.map(({ record, start, end, label }, index) => {
            const strandColor = record.strand === "+" ? color : config.reverseColor;
            return (
              <g
                key={index}
                data-bam-read={record.readName}
                aria-label={`${record.readName}, ${record.strand} strand, ${record.chromosome}:${record.start}-${record.end}`}
                style={{ cursor: interaction?.onClick ? "pointer" : "default" }}
                onClick={() => interaction?.onClick?.(record)}
                onMouseEnter={(event) => {
                  interaction?.onHover?.(record);
                  tooltip.show(record, event);
                }}
                onMouseLeave={() => {
                  interaction?.onLeave?.(record);
                  tooltip.hide();
                }}
              >
                <rect
                  x={start}
                  y={0}
                  width={Math.max(1, end - start)}
                  height={rowHeight}
                  fill="transparent"
                />
                <AlignmentShape
                  record={record}
                  reference={data.reference}
                  x={x}
                  width={width}
                  rowHeight={rowHeight}
                  color={strandColor}
                  showBases={showBases}
                  pixelsPerBase={pixelsPerBase}
                  regionStart={region.start}
                  regionEnd={region.end}
                />
                {label && (
                  <text
                    x={label.x}
                    y={rowHeight / 2}
                    dominantBaseline="central"
                    textAnchor={label.anchor}
                    fontSize={layout.fontSize}
                    fontFamily="monospace"
                    fill={darkenBamColor(strandColor)}
                  >
                    {record.readName}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}

function AlignmentShape({
  record,
  reference,
  x,
  width,
  rowHeight,
  color,
  showBases,
  pixelsPerBase,
  regionStart,
  regionEnd,
}: {
  record: BamRecord;
  reference: TwoBitRecord[];
  x: (position: number) => number;
  width: number;
  rowHeight: number;
  color: string;
  showBases: boolean;
  pixelsPerBase: number;
  regionStart: number;
  regionEnd: number;
}) {
  const y = rowHeight * 0.2;
  const height = rowHeight * 0.6;
  const middle = rowHeight / 2;
  const dark = darkenBamColor(color);
  const clip = (position: number) => Math.max(0, Math.min(width, x(position)));
  const start = clip(record.start);
  const end = clip(record.end);
  const direction = record.strand === "+" ? 1 : -1;
  const tip = record.strand === "+" ? end : start;
  const arrow = Math.min(3, height / 2, (end - start) / 2);
  return (
    <g pointerEvents="none">
      <line x1={start} x2={end} y1={middle} y2={middle} stroke={color} strokeOpacity={0.35} />
      {record.cigar.map((operation) => {
        const operationKey = `${operation.referenceOffset}:${operation.sequenceOffset}:${operation.op}`;
        const position = record.start + operation.referenceOffset;
        if (operation.op === "I" || operation.op === "S") {
          if (position < regionStart || position >= regionEnd) return null;
          return (
            <path
              key={operationKey}
              data-cigar={operation.op}
              d={`M ${x(position)} ${y} V ${y + height} M ${x(position) - 2} ${y} H ${x(position) + 2}`}
              stroke={operation.op === "I" ? "#7e22ce" : color}
              strokeWidth={1.5}
              fill="none"
            />
          );
        }
        if (
          !"MDN=X".includes(operation.op) ||
          position >= regionEnd ||
          position + operation.length <= regionStart
        )
          return null;
        const left = clip(position);
        const right = clip(position + operation.length);
        if (operation.op === "D" || operation.op === "N") {
          return (
            <line
              key={operationKey}
              data-cigar={operation.op}
              x1={left}
              x2={right}
              y1={middle}
              y2={middle}
              stroke={color}
              strokeDasharray={operation.op === "N" ? "3 2" : undefined}
            />
          );
        }
        return (
          <g key={operationKey} data-cigar={operation.op}>
            <rect
              x={left}
              y={y}
              width={Math.max(1, right - left)}
              height={height}
              fill={operation.op === "X" ? "#ef4444" : dark}
              stroke={color}
              strokeWidth={Math.min(1, height / 4)}
            />
            {showBases &&
              Array.from(
                {
                  length: Math.max(
                    0,
                    Math.min(operation.length, regionEnd - position) -
                      Math.max(0, regionStart - position),
                  ),
                },
                (_, i) => {
                  const offset = i + Math.max(0, regionStart - position);
                  const genomicPosition = position + offset;
                  const base = record.sequence[operation.sequenceOffset + offset]?.toUpperCase();
                  if (!base) return null;
                  const ref = reference.find(
                    (part) =>
                      part.chromosome === record.chromosome &&
                      part.start <= genomicPosition &&
                      part.end > genomicPosition,
                  );
                  const referenceBase = ref?.sequence[genomicPosition - ref.start]?.toUpperCase();
                  const mismatch =
                    operation.op === "X" ||
                    (operation.op === "M" &&
                      referenceBase !== undefined &&
                      "ACGT".includes(referenceBase) &&
                      "ACGT".includes(base) &&
                      base !== referenceBase);
                  return (
                    <g key={offset} data-mismatch={mismatch || undefined}>
                      {mismatch && (
                        <rect
                          x={x(genomicPosition)}
                          y={y}
                          width={pixelsPerBase}
                          height={height}
                          fill="#ef4444"
                        />
                      )}
                      <text
                        x={x(genomicPosition) + pixelsPerBase / 2}
                        y={middle}
                        dominantBaseline="central"
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontSize={Math.min(11, pixelsPerBase * 0.8, rowHeight * 0.7)}
                        fill="#ffffff"
                      >
                        {base}
                      </text>
                    </g>
                  );
                },
              )}
          </g>
        );
      })}
      {arrow > 0 && (
        <path
          d={`M ${tip - direction * arrow} ${middle - arrow} L ${tip} ${middle} L ${tip - direction * arrow} ${middle + arrow}`}
          stroke={color}
          strokeWidth={1}
          fill="none"
        />
      )}
    </g>
  );
}
