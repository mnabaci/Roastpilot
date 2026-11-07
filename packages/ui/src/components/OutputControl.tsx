import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './Badge';
import { Button } from './Button';

export interface OutputControlProps {
  /** Output name, e.g. "Heater" or "Fan". */
  label: string;
  /** Current value in percent; undefined (no roaster to report it) or NaN shows a dash. */
  value: number | undefined;
  /** Who drives it while Auto runs the roast; left out in a manual roast, so no badge shows. */
  mode?: 'auto' | 'manual' | undefined;
  /**
   * Called once with the value you chose: when you let go of the slider, or 300 ms after the last
   * arrow key. The values in between only move the number (switches the output to manual).
   */
  onChange: (value: number) => void;
  /** Called when the user hands control back to the profile. Shown only in manual mode. */
  onResumeAuto?: () => void;
  /** `heat` for the heater, `air` for the fan, `neutral` for a drum speed (neither heat nor air). */
  tone?: 'heat' | 'air' | 'neutral';
  min?: number;
  max?: number;
  /** Step from the roaster's channel definition (Skywalker: 5). */
  step?: number;
  disabled?: boolean;
  className?: string;
}

const ACCENT = {
  heat: 'accent-heat-fill',
  air: 'accent-air',
  neutral: 'accent-ink-muted',
} as const;

/** How long the keyboard has to rest before its value is sent. */
export const KEYBOARD_COMMIT_MS = 300;

/** A slider for one roaster output with its value, and an Auto/Manual badge while Auto runs. */
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
  // A reading that isn't a number shows a dash, like no reading at all.
  const reading = value !== undefined && Number.isFinite(value) ? value : undefined;
  const { shown, draft, startDrag, commitNow } = useDraft(reading, onChange);
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-body font-semibold text-ink">
          {label}
        </label>
        <div className="flex items-center gap-2.5">
          {mode ? <Badge tone={manual ? 'heat' : 'air'}>{manual ? 'Manual' : 'Auto'}</Badge> : null}
          <output htmlFor={id} className="min-w-14 text-right text-readout-lg tabular-nums">
            {shown === undefined ? '–' : `${String(shown)}%`}
          </output>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown ?? min}
        disabled={disabled || reading === undefined}
        onPointerDown={startDrag}
        onChange={(event) => {
          draft(Number(event.target.value));
        }}
        onBlur={commitNow}
        className={cn('h-7 w-full cursor-pointer disabled:cursor-not-allowed', ACCENT[tone])}
      />
      {manual && onResumeAuto ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onResumeAuto}>
          Resume auto
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The value under your hand while you move the slider, sent once you are done: on letting go,
 * 300 ms after the last key, or when focus leaves. A send compares against the latest value and
 * calls the latest `onChange`, not the ones from the render that started the timer.
 */
function useDraft(value: number | undefined, onChange: (value: number) => void) {
  const [pending, setPending] = useState<number>();
  const latest = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stopListening = useRef<(() => void) | undefined>(undefined);
  const current = useRef({ value, onChange });
  useEffect(() => {
    current.current = { value, onChange };
  });
  // Gone mid-drag or mid-keys: nothing is sent, and the window stops listening.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      stopListening.current?.();
    },
    [],
  );

  const commitNow = () => {
    clearTimeout(timer.current);
    const next = latest.current;
    latest.current = undefined;
    setPending(undefined);
    if (next !== undefined && next !== current.current.value) current.current.onChange(next);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    commitNow();
  };
  return {
    shown: pending ?? value,
    draft: (next: number) => {
      latest.current = next;
      setPending(next);
      clearTimeout(timer.current);
      if (!dragging.current) timer.current = setTimeout(commitNow, KEYBOARD_COMMIT_MS);
    },
    // Letting go may happen outside the slider, so the window listens; it bubbles there anyway.
    // A cancelled pointer (touch or pen taken over by the system) ends the drag the same way.
    startDrag: () => {
      stopListening.current?.();
      dragging.current = true;
      const stop = () => {
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        stopListening.current = undefined;
      };
      const release = () => {
        stop();
        endDrag();
      };
      stopListening.current = stop;
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    },
    commitNow,
  };
}
