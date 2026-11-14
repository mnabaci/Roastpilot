import { tempNumber, tempSymbol, type Tc4Inputs, type Tc4Wiring } from '@roastpilot/shared';
import { cn } from '@roastpilot/ui';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { inputRole } from './wiring-choices';

/** BT and ET in the chart's colours, so the tile ties to the line it feeds. */
const ROLE_TONE = { BT: 'text-heat', ET: 'text-env' } as const;

/**
 * TC1–TC4 as the board reads them now, each a readout you can follow from the roaster while
 * warming a probe in your hand; BT and ET named under theirs (docs/spec/ui.md, Roasters screen).
 */
export function LiveInputs({
  wiring,
  inputs,
  problem,
}: {
  wiring: Tc4Wiring;
  inputs: Tc4Inputs | undefined;
  problem: string | undefined;
}) {
  const unit = useTemperatureUnit();
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Inputs now" className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((input, i) => {
          const value = inputs?.[i];
          const role = inputRole(wiring, input);
          return (
            <li key={input} className="flex flex-col gap-1 rounded-lg bg-surface-raised px-3 py-2">
              <span className="text-label text-ink-muted">TC{String(input)}</span>
              <span className="flex items-baseline gap-1">
                <span className="text-readout-lg tabular-nums">
                  {value == null ? '—' : tempNumber(value, unit, 1)}
                </span>
                {value == null ? null : (
                  <span className="text-label text-ink-muted">{tempSymbol(unit)}</span>
                )}
              </span>
              {/* A no-break space when empty, so every tile is the same height. */}
              <span className={cn('text-label', role ? ROLE_TONE[role] : 'text-ink-muted')}>
                {role ?? '\u00a0'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-label text-ink-muted">
        {problem ?? 'Warm a probe in your hand to see which it is'}
      </p>
    </div>
  );
}
