import type { TrackSettingsProps } from "@weng-lab/genomebrowser";
import { TrackBaseSettings } from "../shared/settings";
import { TrackHeightSettings } from "../shared/settings/trackHeightSettings";
import {
  TrackSettingsColorField,
  TrackSettingsFieldGrid,
  TrackSettingsFullRow,
  TrackSettingsLayout,
  TrackSettingsNumberField,
  TrackSettingsSection,
  TrackSettingsUrlField,
} from "../shared/settings";
import type { BamConfig, BamInteractionTarget } from "./types";

type Props = TrackSettingsProps<BamConfig, BamInteractionTarget>;

export function BamSettings({ track, updateTrack, ...settings }: Props) {
  const { config } = track;
  const hosted = track.source === "host";

  return (
    <TrackSettingsLayout>
      <TrackBaseSettings
        track={track}
        updateTrack={updateTrack}
        displayOptions={settings.displayOptions}
      >
        <TrackHeightSettings track={track} updateTrack={updateTrack} {...settings} />
      </TrackBaseSettings>

      <TrackSettingsSection title="BAM source">
        <TrackSettingsFieldGrid>
          <TrackSettingsFullRow>
            <TrackSettingsUrlField
              label="BAM URL"
              disabled={hosted}
              required
              value={config.url}
              onCommit={(url) => updateTrack({ config: { url } })}
            />
          </TrackSettingsFullRow>
          <TrackSettingsFullRow>
            <TrackSettingsUrlField
              label="Index URL"
              placeholder="Defaults to the BAM URL plus .bai"
              disabled={hosted}
              value={config.indexUrl ?? ""}
              onCommit={(indexUrl) =>
                updateTrack({ config: { indexUrl: indexUrl.trim() === "" ? undefined : indexUrl } })
              }
            />
          </TrackSettingsFullRow>
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>

      <TrackSettingsSection title="Alignments">
        <TrackSettingsFieldGrid>
          <TrackSettingsNumberField
            label="Fetch below (bp)"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.maxBases}
            validate={(value) =>
              Number.isInteger(value) && value >= 1 ? undefined : "Enter a whole number of bases."
            }
            onCommit={(maxBases) => updateTrack({ config: { maxBases } })}
          />
          <TrackSettingsNumberField
            label="Minimum mapping quality"
            min={0}
            step={1}
            inputMode="numeric"
            value={config.minMappingQuality}
            validate={(value) =>
              Number.isInteger(value) && value >= 0 ? undefined : "Enter zero or a whole number."
            }
            onCommit={(minMappingQuality) => updateTrack({ config: { minMappingQuality } })}
          />
          <TrackSettingsNumberField
            label="Maximum reads drawn"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.maxReads}
            validate={(value) =>
              Number.isInteger(value) && value >= 1 ? undefined : "Draw at least one read."
            }
            onCommit={(maxReads) => updateTrack({ config: { maxReads } })}
          />
          <TrackSettingsColorField
            label="Coverage"
            value={config.coverageColor}
            onCommit={(coverageColor) => updateTrack({ config: { coverageColor } })}
          />
          <TrackSettingsColorField
            label="Reverse strand"
            value={config.reverseStrandColor}
            onCommit={(reverseStrandColor) => updateTrack({ config: { reverseStrandColor } })}
          />
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>

      <TrackSettingsSection title="Junctions">
        <TrackSettingsFieldGrid>
          <TrackSettingsNumberField
            label="Minimum reads"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.minJunctionReads}
            validate={(value) =>
              Number.isInteger(value) && value >= 1 ? undefined : "Require at least one read."
            }
            onCommit={(minJunctionReads) => updateTrack({ config: { minJunctionReads } })}
          />
          <TrackSettingsNumberField
            label="Maximum span (bp)"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.maxJunctionSpan ?? 0}
            validate={(value) =>
              Number.isInteger(value) && value >= 0 ? undefined : "Enter zero for no limit."
            }
            onCommit={(maxJunctionSpan) =>
              updateTrack({
                config: { maxJunctionSpan: maxJunctionSpan <= 0 ? undefined : maxJunctionSpan },
              })
            }
          />
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>
    </TrackSettingsLayout>
  );
}
