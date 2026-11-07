import { RoasterModelSchema, type RoasterId, type RoasterModel } from '@roastpilot/shared';
import { Button, SelectField, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { MODEL_LABEL } from './roaster-model';
import { refusalText } from './roaster-refusal';

const MODELS = RoasterModelSchema.options.map((value) => ({ value, label: MODEL_LABEL[value] }));

/** A name and a model, then Add; the new roaster opens (docs/spec/ui.md, Roasters screen). */
export function AddRoaster({ onAdded }: { onAdded: (id: RoasterId) => void }) {
  const { api, logger } = useDeps();
  const run = useRun();
  const [name, setName] = useState('');
  const [model, setModel] = useState<RoasterModel>('skywalker');
  const [problem, setProblem] = useState<string>();
  const add = () => {
    run('roasters.add-failed', async () => {
      const added = await api.addRoaster({ name: name.trim(), model });
      if (added.ok) {
        onAdded(added.value.id);
        return;
      }
      logger.warn('roasters.refused', { ...added.error });
      setProblem(refusalText(added.error, 'add'));
    });
  };
  return (
    <section aria-label="Add roaster" className="flex max-w-xl flex-col gap-4">
      <h2 className="text-heading">Add roaster</h2>
      <div className="flex flex-wrap items-end gap-2">
        <TextField label="Name" className="min-w-40 flex-1" value={name} onChange={setName} />
        <SelectField
          label="Model"
          className="min-w-32"
          value={model}
          options={MODELS}
          onChange={setModel}
        />
        <Button variant="primary" disabled={name.trim() === ''} onClick={add}>
          Add
        </Button>
      </div>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
