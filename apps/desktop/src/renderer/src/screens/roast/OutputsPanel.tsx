import { FILTER_ON } from '@roastpilot/core';
import { OutputControl } from '@roastpilot/ui';
import { controlsAccess } from './controls-access';
import { isConnected } from './flow-step';
import { useOutput } from './use-output';
import { useRun } from '../../features/use-run';
import { useDeps } from '../../app/app-context';
import { useAuto, useConnection, useRoast, useSafety, useSettings } from '../../stores/use-stores';
import { SwitchCell } from './SwitchCell';
import { outputsHint } from './outputs-hint';
import { isAutoDriven } from '../../lib/roast-phases';

/**
 * Heater and fan sliders (and drum, when it has a speed), then one row of switches: drum, filter
 * fan and cooling (Full control, or with no roast running).
 */
export function OutputsPanel() {
  const level = useSettings((s) => s.settings.controls);
  const phase = useRoast((s) => s.roast.phase);
  const connected = useConnection((s) => isConnected(s.connection));
  const locked = useSafety((s) => s.locked);
  const access = controlsAccess(level, phase, connected);
  // A control the connected roaster doesn't have is hidden; with none connected, all show.
  const channels = useConnection((s) =>
    s.connection.status === 'connected' ? s.connection.channels : undefined,
  );
  const has = (id: string) => !channels || channels.some((c) => c.id === id);
  // A drum with a speed is a slider; an on/off drum stays a switch (docs/spec/ui.md, Outputs).
  const drumChannel = channels?.find((c) => c.id === 'drum');
  const drumSpeed =
    drumChannel?.kind === 'output' && drumChannel.unit === 'percent' ? drumChannel : undefined;
  const { api, logger } = useDeps();
  const run = useRun();
  const auto = useAuto((s) => s.status);
  // Auto drives both outputs from Preheat until Drop; outside that the sliders are simply yours.
  const driving = auto.enabled && isAutoDriven(phase);
  const resume = () => {
    run('auto.resume-failed', async () => {
      const result = await api.autoResume();
      if (!result.ok) logger.info('auto.resume-refused', { ...result.error });
    });
  };
  // The badge only means something while Auto drives; in a manual roast every output is yours.
  const owner = (output: 'heater' | 'fan') =>
    driving ? (auto[output] === 'auto' ? 'auto' : 'manual') : undefined;
  const canResume = driving && connected && !locked;
  const heater = useOutput('heater');
  const fan = useOutput('fan');
  const drum = useOutput('drum');
  const filter = useOutput('filter');
  const cooling = useOutput('cooling');
  const hint = outputsHint({
    locked,
    connected,
    autoStopped: driving && auto.stopReason !== null,
    phase,
    access,
    heaterPct: heater.value,
    drumPct: drum.value,
  });
  return (
    <section aria-label="Outputs" className="flex flex-col gap-5 rounded-xl bg-surface px-5 py-4.5">
      {has('heater') ? (
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
      ) : null}
      {has('fan') ? (
        <OutputControl
          label="Fan"
          tone="air"
          mode={owner('fan')}
          {...(canResume ? { onResumeAuto: resume } : {})}
          value={connected ? fan.value : undefined}
          onChange={fan.set}
          disabled={!access.fan}
        />
      ) : null}
      {drumSpeed ? (
        <OutputControl
          label="Drum"
          tone="neutral"
          min={drumSpeed.min}
          max={drumSpeed.max}
          step={drumSpeed.step}
          value={connected ? drum.value : undefined}
          onChange={drum.set}
          disabled={!access.switches}
        />
      ) : null}
      {/* Labels stay on one line: the cells share the width, and wrap to a new row before a word breaks. */}
      <div className="flex flex-wrap gap-2">
        {has('drum') && !drumSpeed ? (
          <SwitchCell
            label="Drum"
            on={connected && drum.value > 0}
            disabled={!access.switches}
            onToggle={(on) => {
              drum.set(on ? 1 : 0);
            }}
          />
        ) : null}
        {has('filter') ? (
          <SwitchCell
            label="Filter"
            on={connected && filter.value > 0}
            disabled={!access.switches}
            onToggle={(on) => {
              filter.set(on ? FILTER_ON : 0);
            }}
          />
        ) : null}
        {access.showCooling && has('cooling') ? (
          <SwitchCell
            label="Bean cooler"
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
