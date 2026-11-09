import type { Bean, RoastSummary } from '@roastpilot/shared';
import { SelectField } from '@roastpilot/ui';
import { beanDetail } from '../beans/bean-detail';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';

const NONE = 'none';

/**
 * Which bean a saved roast was, changeable afterwards (docs/spec/data-model.md, Changing a saved
 * roast's bean): an imported roast only links; one made here moves its beans' stock with it.
 */
export function BeanLink({ roast, beans }: { roast: RoastSummary; beans: readonly Bean[] }) {
  const { api } = useDeps();
  const run = useRun();
  const [problem, setProblem] = useState<string>();
  return (
    <div className="flex w-60 flex-col gap-1">
      <SelectField
        label="Bean"
        value={roast.beanId === null ? NONE : String(roast.beanId)}
        options={[
          { value: NONE, label: 'No bean' },
          ...beans
            .filter((b) => !b.archived || b.id === roast.beanId)
            .map((b) => ({ value: String(b.id), label: b.name, detail: beanDetail(b) })),
        ]}
        onChange={(value) => {
          setProblem(undefined);
          run(
            'history.set-bean-failed',
            async () => {
              const set = await api.setRoastBean({
                id: roast.id,
                beanId: value === NONE ? null : Number(value),
              });
              if (!set.ok) setProblem("Couldn't change the bean · see Logs");
            },
            { failed: "Couldn't change the bean · try again" },
          );
        }}
      />
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
