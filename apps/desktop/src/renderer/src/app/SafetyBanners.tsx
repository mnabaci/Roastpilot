import type { AcknowledgeError } from '@roastpilot/shared';
import { AlertBanner } from '@roastpilot/ui';
import { useState } from 'react';
import { LOST_CONNECTION } from '../stores/safety-store';
import { useConnection, useRoast, useSafety } from '../stores/use-stores';
import { useDeps } from './app-context';
import { safetyCopy } from './safety-copy';
import { useRun } from '../features/use-run';

const refusedText = (error: AcknowledgeError) =>
  `Still tripped: ${error.rules.map((rule) => safetyCopy(rule).text.split(' · ')[0]).join(', ')}`;

/** The heater was on or could be: a preheat or a roast is running. */
const RUNNING = new Set(['preheat', 'roasting', 'development', 'cooling']);

/**
 * One banner per tripped rule; the first critical one carries Acknowledge for the heater lock. A
 * separate Heater locked banner shows only when the lock outlives every trip (docs/spec/ui.md).
 * While the roaster is lost and the session reconnects, Acknowledge can't work: that banner offers
 * Disconnect instead, and no banner offers Acknowledge (docs/spec/safety.md, Lost connection).
 */
export function SafetyBanners() {
  const { api } = useDeps();
  const run = useRun();
  const locked = useSafety((s) => s.locked);
  const tripped = useSafety((s) => s.tripped);
  const reconnected = useSafety((s) => s.reconnected === true);
  const status = useConnection((s) => s.connection.status);
  const running = useRoast((s) => RUNNING.has(s.roast.phase));
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
  // Lost and reconnecting: the lock can't lift until readings return, so nothing offers it.
  const reconnecting = status === 'lost' && tripped.includes(LOST_CONNECTION);
  const disconnect = () => {
    run('disconnect.failed', () => api.disconnect(), {
      failed: "Couldn't disconnect · try again",
    });
  };
  const acknowledgeOn =
    locked && !reconnecting ? tripped.findIndex((r) => safetyCopy(r).kind === 'critical') : -1;
  return (
    <div className="flex shrink-0 flex-col gap-2 px-6 pt-4">
      {tripped.map((rule, i) => {
        const { kind, text } = safetyCopy(rule);
        if (rule === LOST_CONNECTION && reconnecting) {
          // Red only while the heater was or could be on; idle, it's a warning.
          return (
            <AlertBanner
              key={rule}
              kind={running ? 'critical' : 'warning'}
              onDismiss={disconnect}
              dismissLabel="Disconnect"
            >
              Roaster unplugged or not answering · heater off · trying to reconnect
            </AlertBanner>
          );
        }
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
      {locked && acknowledgeOn === -1 && !reconnecting ? (
        <AlertBanner kind="critical" onDismiss={acknowledge} dismissLabel="Acknowledge">
          {refused ??
            (reconnected && status === 'connected'
              ? 'Roaster back · heater stays off until you acknowledge'
              : 'Heater locked · acknowledge when the roaster is safe')}
        </AlertBanner>
      ) : null}
    </div>
  );
}
