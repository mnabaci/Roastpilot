import type { AcknowledgeError } from '@roastpilot/shared';
import { AlertBanner } from '@roastpilot/ui';
import { useState } from 'react';
import { useSafety } from '../stores/use-stores';
import { useDeps } from './app-context';
import { safetyCopy } from './safety-copy';
import { useRun } from '../features/use-run';

const refusedText = (error: AcknowledgeError) =>
  `Still tripped: ${error.rules.map((rule) => safetyCopy(rule).text.split(' · ')[0]).join(', ')}`;

/**
 * One banner per tripped rule; the first critical one carries Acknowledge for the heater lock. A
 * separate Heater locked banner shows only when the lock outlives every trip (docs/spec/ui.md).
 */
export function SafetyBanners() {
  const { api } = useDeps();
  const run = useRun();
  const locked = useSafety((s) => s.locked);
  const tripped = useSafety((s) => s.tripped);
  // A refusal is about the trips it was asked over: once they change, the banners speak again.
  const [refusal, setRefusal] = useState<{ text: string; over: readonly string[] }>();
  const refused = refusal?.over === tripped ? refusal.text : undefined;
  if (!locked && tripped.length === 0) return null;
  const acknowledge = () => {
    run('safety.acknowledge-failed', async () => {
      const result = await api.acknowledgeSafety();
      setRefusal(result.ok ? undefined : { text: refusedText(result.error), over: tripped });
    });
  };
  const acknowledgeOn = locked ? tripped.findIndex((r) => safetyCopy(r).kind === 'critical') : -1;
  return (
    <div className="flex shrink-0 flex-col gap-2 px-6 pt-4">
      {tripped.map((rule, i) => {
        const { kind, text } = safetyCopy(rule);
        return i === acknowledgeOn ? (
          <AlertBanner key={rule} kind={kind} onDismiss={acknowledge} dismissLabel="Acknowledge">
            {refused ?? text}
          </AlertBanner>
        ) : (
          <AlertBanner key={rule} kind={kind}>
            {text}
          </AlertBanner>
        );
      })}
      {locked && acknowledgeOn === -1 ? (
        <AlertBanner kind="critical" onDismiss={acknowledge} dismissLabel="Acknowledge">
          {refused ?? 'Heater locked · acknowledge when the roaster is safe'}
        </AlertBanner>
      ) : null}
    </div>
  );
}
