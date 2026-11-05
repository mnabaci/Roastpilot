import { FILTER_ON } from '@roastpilot/core';
import { OutputControl } from '@roastpilot/ui';
import { controlsAccess } from './controls-access';
import { isConnected } from './flow-step';
import { useOutput } from './use-output';
import { useRun } from '../../features/use-run';
import { useDeps } from '../../app/app-context';
import { useAuto, useConnection, useRoast, useSafety, useSettings } from '../../stores/use-stores';
import { OnOffButton } from './OnOffButton';

/**
 * Heater and fan sliders, the drum and filter fan switches and the cooling switch (Full control,
 * or with no roast running).
 */
export function OutputsPanel() {
  const level = useSettings((s) => s.settings.controls);
  const phase = useRoast((s) => s.roast.phase);
  const connected = useConnection((s) => isConnected(s.connection));
  const locked = useSafety((s) => s.locked);
  const access = controlsAccess(level, phase, connected);
  const { api, logger } = useDeps();
  const run = useRun();
  const auto = useAuto((s) => s.status);
  // Auto drives both outputs from Preheat until Drop; outside that the sliders are simply yours.
  const driving = auto.enabled && ['preheat', 'roasting', 'development'].includes(phase);
  const resume = () => {
    run('auto.resume-failed', async () => {
      const result = await api.autoResume();
      if (!result.ok) logger.info('auto.resume-refused', { ...result.error });
    });
  };
  const owner = (output: 'heater' | 'fan') =>
    driving && auto[output] === 'auto' ? 'auto' : 'manual';
  const canResume = driving && connected && !locked;
  const heater = useOutput('heater');
  const fan = useOutput('fan');
  const drum = useOutput('drum');
  const filter = useOutput('filter');
  const cooling = useOutput('cooling');
  const hint = locked
    ? 'Heater locked · acknowledge above'
    : driving && auto.stopped
      ? 'Auto stopped · heater and fan are yours'
      : heater.value > 0 && drum.value === 0
        ? 'Drum is off'
        : !access.heater && connected
          ? phase === 'cooling'
            ? 'Cooling · heater off, fan at 100%'
            : 'Heater waits for Preheat'
          : undefined;
  return (
    <section aria-label="Outputs" className="flex flex-col gap-5 rounded-xl bg-surface px-5 py-4.5">
      <OutputControl
        label="Heater"
        tone="heat"
        mode={owner('heater')}
        {...(canResume ? { onResumeAuto: resume } : {})}
        // With no roaster, its last values would look live: show a dash instead.
        value={connected ? heater.value : undefined}
        onChange={heater.set}
        disabled={!access.heater || locked}
      />
      <OutputControl
        label="Fan"
        tone="air"
        mode={owner('fan')}
        {...(canResume ? { onResumeAuto: resume } : {})}
        value={connected ? fan.value : undefined}
        onChange={fan.set}
        disabled={!access.fan}
      />
      <div className="flex flex-col gap-2">
        <OnOffButton
          label="Drum"
          on={connected && drum.value > 0}
          disabled={!access.switches}
          onToggle={(on) => {
            drum.set(on ? 1 : 0);
          }}
        />
        <OnOffButton
          label="Filter"
          on={connected && filter.value > 0}
          disabled={!access.switches}
          onToggle={(on) => {
            filter.set(on ? FILTER_ON : 0);
          }}
        />
        {access.showCooling ? (
          <OnOffButton
            label="Cooling"
            on={connected && cooling.value > 0}
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
