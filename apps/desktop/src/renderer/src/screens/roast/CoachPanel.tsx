import { sayInUnit } from '@roastpilot/shared';
import { CoachCard } from '@roastpilot/ui';
import { useRef, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useCoach } from '../../stores/use-stores';
import { coachApplyFailed } from './coach-apply-failed';
import { calibrationNote, coachChanges, headsUpLine } from './coach-text';

/**
 * The coach card above the outputs in a manual roast (docs/spec/manual-mode.md, Coach). Main
 * decides when there is one; Apply and Dismiss name the card you saw.
 */
export function CoachPanel() {
  const status = useCoach((s) => s.status);
  const unit = useTemperatureUnit();
  const { api, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
  // The card whose Apply is on its way: a second click can't send it twice. The ref catches a
  // second click before React has drawn the busy button; the state draws it.
  const [applyingId, setApplyingId] = useState<number>();
  const pending = useRef<number>(undefined);
  const { advice } = status;
  if (!advice) return null;
  const note = calibrationNote(status);
  const dismiss = () => {
    run('coach.dismiss-failed', () => api.coachDismiss({ id: advice.id }), {
      failed: "Couldn't dismiss · try again",
    });
  };
  if (advice.kind !== 'setting') {
    return (
      <CoachCard
        variant="heads-up"
        line={headsUpLine(advice, unit)}
        {...(note ? { note } : {})}
        onDismiss={dismiss}
      />
    );
  }
  const apply = () => {
    if (pending.current === advice.id) return;
    pending.current = advice.id;
    setApplyingId(advice.id);
    run(
      'coach.apply-failed',
      async () => {
        try {
          const result = await api.coachApply({ id: advice.id });
          if (result.ok) return;
          logger.info('coach.apply-refused', { ...result.error });
          const text = coachApplyFailed(result.error);
          if (text) toast('error', text);
        } finally {
          pending.current = undefined;
          setApplyingId(undefined);
        }
      },
      { failed: "Couldn't apply the suggestion · try again" },
    );
  };
  return (
    <CoachCard
      changes={coachChanges(advice)}
      applying={applyingId === advice.id}
      reason={sayInUnit(advice.reason, unit)}
      {...(note ? { note } : {})}
      onApply={apply}
      onDismiss={dismiss}
    />
  );
}
