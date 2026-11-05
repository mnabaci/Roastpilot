import { formatClock } from '@roastpilot/ui';
import type { SoakTime } from '@roastpilot/shared';
import { useSettings } from '../../stores/use-stores';
import { Choice } from './Choice';
import { useSaveSettings } from './use-save-settings';

const SOAK_TIMES: readonly SoakTime[] = [30, 45, 60, 75, 90, 120];

/** Auto's own settings (docs/spec/roast-control.md, Auto mode). */
export function AutoSection() {
  const soakTimeS = useSettings((s) => s.settings.soakTimeS);
  const save = useSaveSettings();
  return (
    <section aria-labelledby="auto-heading" className="flex flex-col gap-3">
      <h2 id="auto-heading" className="text-heading">
        Auto
      </h2>
      <div className="flex flex-col gap-2">
        <p className="text-body font-semibold">Soak time</p>
        <Choice
          label="Soak time"
          options={SOAK_TIMES.map((id) => ({ id, label: formatClock(id) }))}
          value={soakTimeS}
          onChange={(soak) => {
            save({ soakTimeS: soak });
          }}
        />
        <p className="text-label text-ink-muted">Heater at 0 after charge · for every profile</p>
      </div>
    </section>
  );
}
