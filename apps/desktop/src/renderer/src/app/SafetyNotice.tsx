import { Button, Mark } from '@roastpilot/ui';
import { Eye, Scale, ShieldOff, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';

/** What it asks of you, one line each (docs/spec/safety.md, Safety notice). */
const POINTS: readonly { icon: LucideIcon; text: string }[] = [
  { icon: Eye, text: 'Stay with the roaster · in Manual and in Auto' },
  { icon: ShieldOff, text: 'Auto is not a safety device' },
  { icon: Zap, text: 'Keep the fuses, cut-outs and watchdog in place' },
  { icon: Scale, text: 'Free software · no warranty (GPL-3.0)' },
];

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
    <div className="flex min-h-full items-center justify-center px-5 py-8">
      <section
        aria-labelledby="safety-notice-title"
        aria-describedby="safety-notice-risk"
        className="flex w-full max-w-120 flex-col items-center gap-6 rounded-xl border border-border bg-surface p-8 text-center"
      >
        <Mark withName />
        <div className="flex flex-col gap-1">
          <h1 id="safety-notice-title" className="text-title">
            Roastpilot switches a heater
          </h1>
          <p id="safety-notice-risk" className="text-body text-ink-muted">
            Use it at your own risk
          </p>
        </div>
        <ul className="flex w-full flex-col gap-3 text-left text-body">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <Icon aria-hidden="true" className="size-5 shrink-0 text-warning" />
              {text}
            </li>
          ))}
        </ul>
        <Button ref={button} variant="primary" className="w-full" onClick={onDone}>
          {action === 'accept' ? 'I understand · continue' : 'Close'}
        </Button>
      </section>
    </div>
  );
}
