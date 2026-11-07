import { Button, Mark } from '@roastpilot/ui';
import { useEffect, useRef } from 'react';

/** The four points, in the order they matter at the roaster (docs/spec/safety.md, Safety notice). */
const POINTS = [
  'Never leave the roaster alone, in Manual or in Auto.',
  'Auto is not a safety device: software and computers fail.',
  "Keep the roaster's own fuses, cut-outs and the sketch's watchdog in place.",
  'Free software with no warranty (GPL-3.0).',
] as const;

export interface SafetyNoticeProps {
  /** First launch: "I understand · continue". From Help: "Close". */
  action: 'accept' | 'close';
  onDone: () => void;
}

/** Roastpilot switches a heater: what that asks of you, read once before anything else. */
export function SafetyNotice({ action, onDone }: SafetyNoticeProps) {
  const button = useRef<HTMLButtonElement>(null);
  // Its one action takes focus, so Enter answers it and a screen reader starts here.
  useEffect(() => {
    button.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby="safety-notice-title"
      className="mx-auto flex w-full max-w-120 flex-col items-center gap-5 px-5 py-8 text-center"
    >
      <Mark withName />
      <h1 id="safety-notice-title" className="text-heading">
        Roastpilot switches a heater · use it at your own risk
      </h1>
      <ul className="flex flex-col gap-2 text-left text-body">
        {POINTS.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden="true" className="text-warning">
              •
            </span>
            {point}
          </li>
        ))}
      </ul>
      <Button ref={button} variant="primary" onClick={onDone}>
        {action === 'accept' ? 'I understand · continue' : 'Close'}
      </Button>
    </section>
  );
}
