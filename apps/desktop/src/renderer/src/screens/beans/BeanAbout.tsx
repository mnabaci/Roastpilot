import { beanHints } from '@roastpilot/core';
import type { Bean } from '@roastpilot/shared';
import { CollapsibleCard } from '@roastpilot/ui';
import { Lightbulb } from 'lucide-react';
import { aboutSummary } from './bean-detail';
import { BeanFields } from './BeanFields';
import type { BeanDraftState } from './use-bean-draft';

/**
 * A bean's record as one folding card (docs/spec/ui.md, Beans screen): its values in a grid,
 * fields in Edit, and its hints at the foot while reading.
 */
export function BeanAbout({
  bean,
  state,
  editing,
  open,
  onOpenChange,
}: {
  bean: Bean | undefined;
  state: BeanDraftState;
  editing: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hints = bean && !editing ? beanHints(bean) : [];
  return (
    <CollapsibleCard
      title="About this bean"
      summary={aboutSummary(state.draft)}
      open={open}
      onOpenChange={onOpenChange}
    >
      <BeanFields bean={bean} state={state} readOnly={!editing} />
      {hints.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-4">
          {hints.map((hint) => (
            <li key={hint} className="flex items-start gap-2 text-label text-ink-muted">
              <Lightbulb aria-hidden="true" className="mt-px size-4 shrink-0" />
              {hint}
            </li>
          ))}
        </ul>
      ) : null}
    </CollapsibleCard>
  );
}
