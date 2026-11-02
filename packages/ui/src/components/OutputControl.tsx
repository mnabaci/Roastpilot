import { useId } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './Badge';
import { Button } from './Button';

export interface OutputControlProps {
  /** Output name, e.g. "Heater" or "Fan". */
  label: string;
  /** Current value in percent. */
  value: number;
  mode: 'auto' | 'manual';
  /** Called with the new value when the user moves the slider (switches the output to manual). */
  onChange: (value: number) => void;
  /** Called when the user hands control back to the profile. Shown only in manual mode. */
  onResumeAuto?: () => void;
  /** `heat` for the heater, `air` for the fan. */
  tone?: 'heat' | 'air';
  min?: number;
  max?: number;
  /** Step from the roaster's channel definition (Skywalker: 5). */
  step?: number;
  disabled?: boolean;
  className?: string;
}

/** A slider for one roaster output with its value and an Auto/Manual badge. */
export function OutputControl({
  label,
  value,
  mode,
  onChange,
  onResumeAuto,
  tone = 'heat',
  min = 0,
  max = 100,
  step = 5,
  disabled = false,
  className,
}: OutputControlProps) {
  const id = useId();
  const manual = mode === 'manual';
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-body font-semibold text-ink">
          {label}
        </label>
        <div className="flex items-center gap-2.5">
          <Badge tone={manual ? 'heat' : 'air'}>{manual ? 'Manual' : 'Auto'}</Badge>
          <output htmlFor={id} className="min-w-14 text-right text-readout-lg tabular-nums">
            {value}%
          </output>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className={cn(
          'h-7 w-full cursor-pointer disabled:cursor-not-allowed',
          tone === 'heat' ? 'accent-heat-fill' : 'accent-air',
        )}
      />
      {manual && onResumeAuto ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onResumeAuto}>
          Resume auto
        </Button>
      ) : null}
    </div>
  );
}
