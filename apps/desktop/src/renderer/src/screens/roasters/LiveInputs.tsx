import { tempNumber, tempSymbol, type Tc4Inputs, type Tc4Wiring } from '@roastpilot/shared';
import { StatCard } from '@roastpilot/ui';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { inputRole } from './wiring-choices';

/** BT and ET in the chart's colours, so the tile ties to the line it feeds. */
const ROLE_TONE = { BT: 'heat', ET: 'env' } as const;

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
            <li key={input}>
              <StatCard
                size="compact"
                label={`TC${String(input)}`}
                value={value == null ? undefined : tempNumber(value, unit, 1)}
                unit={tempSymbol(unit)}
                tone={role ? ROLE_TONE[role] : 'ink'}
                context={role ?? 'Not used'}
              />
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
