import { CircleStop } from 'lucide-react';
import type { RoastAction } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { ConfirmButton } from '../../features/ConfirmButton';
import { autoFlowStep } from './auto-flow';
import { END_ROAST, endConsequences, flowHint, flowStep, isConnected } from './flow-step';
import { useActiveProfile } from './use-active-profile';
import { DrumCooling } from './DrumCooling';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';
import { roastActionFailed, roastActionRefused } from './roast-action-failed';
import { useDeps } from '../../app/app-context';
import { useAuto, useConnection, useRoast } from '../../stores/use-stores';

/** The one next action for the state, with its one-line hint. */
export function FlowPanel({
  coolingLeftS,
  developmentS,
  heaterPct,
  onConnect,
}: {
  coolingLeftS: number | undefined;
  developmentS: number | undefined;
  heaterPct: number | undefined;
  onConnect: () => void;
}) {
  const { api, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
  const connected = useConnection((s) => isConnected(s.connection));
  const lost = useConnection((s) => s.connection.status === 'lost');
  const roast = useRoast((s) => s.roast);
  const { phase } = roast;
  const auto = useAuto((s) => s.status);
  const profile = useActiveProfile();
  const autoStep = autoFlowStep(roast, auto, profile?.profile, { developmentS, heaterPct });
  const step = autoStep ?? flowStep(roast);
  const act = (action: RoastAction) => {
    run(
      'roast.action-failed',
      async () => {
        const result = await api.roastAction(action);
        if (result.ok) return;
        logger.info('roast.action-refused', { ...result.error });
        toast('error', roastActionRefused(action));
      },
      { failed: roastActionFailed(action) },
    );
  };
  if (lost) {
    // Main is already reopening the port; there is nothing to press until readings are back.
    return (
      <p role="status" className="text-body text-ink-muted">
        Reconnecting… · check the cable
      </p>
    );
  }
  if (!connected) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" onClick={onConnect}>
          Connect a roaster
        </Button>
        <p className="text-label text-ink-muted">Pick a roaster and connect it in Roasters</p>
      </div>
    );
  }
  const hint = autoStep?.hint ?? flowHint(roast, { coolingLeftS });
  const noRoast = phase === 'ready' || phase === 'done';
  return (
    <div className="flex flex-col gap-2">
      {step.chargeSoon ? (
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            run(
              'auto.charge-soon-failed',
              async () => {
                const result = await api.autoChargeSoon();
                if (result.ok) return;
                logger.info('auto.charge-soon-refused', { ...result.error });
                toast('error', "Can't charge soon now · the roast has moved on");
              },
              { failed: "Couldn't charge soon · try again" },
            );
          }}
        >
          Charge soon
        </Button>
      ) : null}
      {step.primary ? (
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            if (step.primary) act(step.primary.action);
          }}
        >
          {step.primary.label}
        </Button>
      ) : null}
      {/* The hint explains the primary action, so it sits right under it. */}
      <p className="text-label text-ink-muted">{hint}</p>
      {step.secondary ? (
        <Button
          variant="secondary"
          onClick={() => {
            if (step.secondary) act(step.secondary.action);
          }}
        >
          {step.secondary.label}
        </Button>
      ) : null}
      {noRoast ? <DrumCooling onAction={act} /> : null}
      {step.quiet ? (
        <Button
          variant="ghost"
          onClick={() => {
            if (step.quiet) act(step.quiet.action);
          }}
        >
          {step.quiet.label}
        </Button>
      ) : null}
      {step.stop === END_ROAST ? (
        // The one normal stop: easy to find, amber and apart, never the red of Emergency stop.
        <div className="mt-1 border-t border-border pt-3">
          <ConfirmButton
            key={phase}
            variant="secondary"
            icon={<CircleStop aria-hidden="true" />}
            label={END_ROAST.label}
            question="End the roast?"
            consequences={endConsequences(phase)}
            cancelLabel="Keep roasting"
            confirmLabel={END_ROAST.label}
            caution
            onConfirm={() => {
              act('end');
            }}
            stacked
          />
        </div>
      ) : step.stop ? (
        <ConfirmButton
          key={phase}
          variant="secondary"
          label={step.stop.label}
          question={step.stop.question}
          confirmLabel={step.stop.label}
          onConfirm={() => {
            act('end');
          }}
          stacked
        />
      ) : null}
    </div>
  );
}
