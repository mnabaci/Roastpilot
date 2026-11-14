import type { RoastPhase } from '@roastpilot/shared';
import type { ReactNode } from 'react';
import { CoachPanel } from './CoachPanel';
import { OutputsPanel } from './OutputsPanel';
import { RoastSetupPanel } from './RoastSetupPanel';
import { StayClose } from './StayClose';

/** The side panel shows what the moment needs (docs/spec/ui.md, Side panel follows the roast). */
export function RoastControls({
  phase,
  hasRoaster,
  flow,
}: {
  phase: RoastPhase;
  hasRoaster: boolean;
  flow: ReactNode;
}) {
  const idle = phase === 'ready' || phase === 'done';
  // A new key when a roast starts or ends, so a half-open Change never carries across.
  const setupPanel = <RoastSetupPanel key={idle ? 'idle' : 'roasting'} />;
  return (
    // Relative, so a screen-reader-only label low in the panel never stretches the page.
    <aside
      aria-label="Controls"
      className="relative flex min-h-0 w-80 flex-col gap-4 overflow-y-auto"
    >
      {!hasRoaster ? (
        <>
          {flow}
          {setupPanel}
        </>
      ) : phase === 'ready' ? (
        // Before a roast you fill the setup in, so it leads.
        <>
          {setupPanel}
          {flow}
          <OutputsPanel />
        </>
      ) : (
        // During and after a roast the controls come right under the action.
        <>
          {flow}
          <CoachPanel />
          <OutputsPanel />
          {setupPanel}
          {phase === 'done' ? null : <StayClose />}
        </>
      )}
    </aside>
  );
}
