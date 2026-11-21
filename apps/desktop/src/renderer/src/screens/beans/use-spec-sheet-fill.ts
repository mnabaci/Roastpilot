import type { SpecSheetFields } from '@roastpilot/shared';
import { useState } from 'react';
import { useAiHelpers } from '../../features/use-ai-keys';
import { fillFromSheet } from './bean-draft';
import type { BeanDraftState } from './use-bean-draft';

/**
 * Fill from spec sheet on a bean in Edit, or on Add bean: whether it is offered (the AI helpers
 * on with a Claude key), the dialog, and one line after it saying how many fields it filled.
 */
export function useSpecSheetFill(record: BeanDraftState, { isNew }: { isNew: boolean }) {
  const { sheets } = useAiHelpers();
  const [open, setOpen] = useState(false);
  const [filled, setFilled] = useState<string>();
  return {
    offered: sheets,
    open,
    show: () => {
      setFilled(undefined);
      setOpen(true);
    },
    close: () => {
      setOpen(false);
    },
    onFilled: (fields: SpecSheetFields) => {
      const { cells, count } = fillFromSheet(record.draft, fields, { isNew });
      if (count > 0) record.change(cells);
      setFilled(
        count === 0
          ? 'Nothing new from that sheet · your fields are already filled'
          : `Filled ${String(count)} ${count === 1 ? 'field' : 'fields'} from the sheet · check them, then Save`,
      );
    },
    /** The line after a fill, until the next one or Save. */
    filled,
    forget: () => {
      setFilled(undefined);
    },
  };
}
