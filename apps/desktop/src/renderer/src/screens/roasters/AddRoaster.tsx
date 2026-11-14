import {
  modelFacts,
  RoasterModelSchema,
  type RoasterId,
  type RoasterModel,
} from '@roastpilot/shared';
import { Button, cn, SelectField, TitleField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { refusalText } from './roaster-refusal';
import { PAGE_WIDTH } from '../../lib/page-width';

const MODELS = RoasterModelSchema.options.map((value) => ({
  value,
  label: modelFacts(value).label,
}));

/** A name and a model, then Add; the new roaster opens (docs/spec/ui.md, Roasters screen). */
export function AddRoaster({ onAdded }: { onAdded: (id: RoasterId) => void }) {
  const { api, logger } = useDeps();
  const run = useRun();
  const [name, setName] = useState('');
  const [model, setModel] = useState<RoasterModel>('skywalker');
  const [problem, setProblem] = useState<string>();
  const add = () => {
    run(
      'roasters.add-failed',
      async () => {
        const added = await api.addRoaster({ name: name.trim(), model });
        if (added.ok) {
          onAdded(added.value.id);
          return;
        }
        logger.warn('roasters.refused', { ...added.error });
        setProblem(refusalText(added.error, 'add'));
      },
      { failed: "Couldn't add the roaster · try again" },
    );
  };
  return (
    <section aria-label="Add roaster" className={cn('flex flex-col gap-4', PAGE_WIDTH)}>
      {/* The name is the title, as on every record's page: a field here, Add at the right. */}
      <header className="flex min-h-control-sm min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1">
          <TitleField value={name} placeholder="Name this roaster" onChange={setName} />
        </div>
        <Button size="sm" variant="primary" disabled={name.trim() === ''} onClick={add}>
          Add
        </Button>
      </header>
      <SelectField
        label="Model"
        className="max-w-80"
        value={model}
        options={MODELS}
        onChange={setModel}
      />
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
