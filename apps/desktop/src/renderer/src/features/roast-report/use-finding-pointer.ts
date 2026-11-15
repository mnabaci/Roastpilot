import type { RoastReport } from '@roastpilot/core';
import type { RoastId } from '@roastpilot/shared';
import { useState } from 'react';
import { findingSpan, type TimeSpan } from './report-text';
import type { FindingPointer } from './ReportFindings';

interface Pointed {
  id: RoastId | undefined;
  preview?: number | undefined;
  pinned?: number | undefined;
}

/**
 * Which of a roast's findings its chart picks out: the one under the pointer or focus, else the
 * one last clicked. Another roast starts with none. `onPin` runs as one is clicked, so the screen
 * can bring the chart into view.
 */
export function useFindingPointer(
  roastId: RoastId | undefined,
  report: RoastReport | undefined,
  onPin: () => void,
): { pointer: FindingPointer; span: TimeSpan | undefined } {
  const [state, setState] = useState<Pointed>({ id: roastId });
  // Kept per roast: what was pointed at on another roast is gone.
  const forThis = (s: Pointed): Pointed => (s.id === roastId ? s : { id: roastId });
  const current = forThis(state);
  const spanOf = (index: number | undefined) => {
    const finding = index === undefined ? undefined : report?.findings[index];
    return finding && report ? findingSpan(finding, report) : undefined;
  };
  return {
    pointer: {
      pinned: current.pinned,
      onPreview: (preview) => {
        setState((s) => ({ ...forThis(s), preview }));
      },
      onPin: (pinned) => {
        setState((s) => ({ ...forThis(s), pinned }));
        if (pinned !== undefined) onPin();
      },
    },
    span: spanOf(current.preview) ?? spanOf(current.pinned),
  };
}
