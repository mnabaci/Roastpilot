import { FILTER_ON } from '@roastpilot/core';
import { OutputControl } from '@roastpilot/ui';
import { controlsAccess } from './controls-access';
import { isConnected } from './flow-step';
import { useOutput } from './use-output';
import { useConnection, useRoast, useSafety, useSettings } from '../../stores/use-stores';
import { OnOffButton } from './OnOffButton';

/** Heater and fan sliders, the drum and filter fan switches and, in Full control, the cooling switch. */
export function OutputsPanel() {
  const level = useSettings((s) => s.settings.controls);
  const phase = useRoast((s) => s.roast.phase);
  const connected = useConnection((s) => isConnected(s.connection));
  const locked = useSafety((s) => s.locked);
  const access = controlsAccess(level, phase, connected);
  const heater = useOutput('heater');
  const fan = useOutput('fan');
  const drum = useOutput('drum');
  const filter = useOutput('filter');
  const cooling = useOutput('cooling');
  const hint = locked
    ? 'Heater locked · acknowledge above'
    : heater.value > 0 && drum.value === 0
      ? 'Drum is off'
      : !access.outputs && connected
        ? 'Heater and fan wait for Preheat'
        : undefined;
  return (
    <section aria-label="Outputs" className="flex flex-col gap-5 rounded-xl bg-surface px-5 py-4.5">
      <OutputControl
        label="Heater"
        tone="heat"
        mode="manual"
        value={heater.value}
        onChange={heater.set}
        disabled={!access.outputs || locked}
      />
      <OutputControl
        label="Fan"
        tone="air"
        mode="manual"
        value={fan.value}
        onChange={fan.set}
        disabled={!access.outputs}
      />
      <div className="flex flex-col gap-2">
        <OnOffButton
          label="Drum"
          on={drum.value > 0}
          disabled={!access.switches}
          onToggle={(on) => {
            drum.set(on ? 1 : 0);
          }}
        />
        <OnOffButton
          label="Filter"
          on={filter.value > 0}
          disabled={!access.switches}
          onToggle={(on) => {
            filter.set(on ? FILTER_ON : 0);
          }}
        />
        {access.showCooling ? (
          <OnOffButton
            label="Cooling"
            on={cooling.value > 0}
            disabled={!connected}
            onToggle={(on) => {
              cooling.set(on ? 100 : 0);
            }}
          />
        ) : null}
      </div>
      {hint ? <p className="text-label text-ink-muted">{hint}</p> : null}
    </section>
  );
}
