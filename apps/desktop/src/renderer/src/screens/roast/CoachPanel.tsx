import { CoachCard } from '@roastpilot/ui';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';
import { useCoach } from '../../stores/use-stores';
import { coachApplyFailed } from './coach-apply-failed';
import { calibrationNote, coachChange, headsUpLine } from './coach-text';

/**
 * The coach card above the outputs in a manual roast (docs/spec/manual-mode.md, Coach). Main
 * decides when there is one; Apply and Dismiss name the card you saw.
 */
export function CoachPanel() {
  const status = useCoach((s) => s.status);
  const { api, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
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
        line={headsUpLine(advice)}
        {...(note ? { note } : {})}
        onDismiss={dismiss}
      />
    );
  }
  const apply = () => {
    run(
      'coach.apply-failed',
      async () => {
        const result = await api.coachApply({ id: advice.id });
        if (result.ok) return;
        logger.info('coach.apply-refused', { ...result.error });
        const text = coachApplyFailed(result.error);
        if (text) toast('error', text);
      },
      { failed: "Couldn't apply the suggestion · try again" },
    );
  };
  return (
    <CoachCard
      change={coachChange(advice)}
      reason={advice.reason}
      {...(note ? { note } : {})}
      onApply={apply}
      onDismiss={dismiss}
    />
  );
}
