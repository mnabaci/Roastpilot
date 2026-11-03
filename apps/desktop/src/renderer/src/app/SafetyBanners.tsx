import type { AcknowledgeError } from '@roastpilot/shared';
import { AlertBanner } from '@roastpilot/ui';
import { useState } from 'react';
import { useSafety } from '../stores/use-stores';
import { useDeps } from './app-context';
import { safetyCopy } from './safety-copy';
import { useRun } from '../features/use-run';

const refusedText = (error: AcknowledgeError) =>
  `Still tripped: ${error.rules.map((rule) => safetyCopy(rule).text.split(' · ')[0]).join(', ')}`;

/** One banner per tripped rule, then the heater lock with its Acknowledge (docs/spec/safety.md). */
export function SafetyBanners() {
  const { api } = useDeps();
  const run = useRun();
  const locked = useSafety((s) => s.locked);
  const tripped = useSafety((s) => s.tripped);
  const [refused, setRefused] = useState<string | undefined>();
  if (!locked && tripped.length === 0) return null;
  const acknowledge = () => {
    run('safety.acknowledge-failed', async () => {
      const result = await api.acknowledgeSafety();
      setRefused(result.ok ? undefined : refusedText(result.error));
    });
  };
  return (
    <div className="flex flex-col gap-2 px-6 pt-4">
      {tripped.map((rule) => {
        const { kind, text } = safetyCopy(rule);
        return (
          <AlertBanner key={rule} kind={kind}>
            {text}
          </AlertBanner>
        );
      })}
      {locked ? (
        <AlertBanner kind="critical" onDismiss={acknowledge} dismissLabel="Acknowledge">
          {refused ?? 'Heater locked · acknowledge when the roaster is safe'}
        </AlertBanner>
      ) : null}
    </div>
  );
}
