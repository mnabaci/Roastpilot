import { RoasterModelSchema, type RoasterModel } from '@roastpilot/shared';
import { Badge, Button, SelectField, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useConnection, useRoasters } from '../../stores/use-stores';
import { RoasterEditor } from './RoasterEditor';

const MODEL_LABEL: Readonly<Record<RoasterModel, string>> = {
  skywalker: 'Skywalker',
  simulator: 'Simulator',
};
const MODELS = RoasterModelSchema.options.map((value) => ({
  value,
  label: MODEL_LABEL[value],
}));

/** The roaster records: pick the active one, edit one, add one (docs/spec/roasters.md). */
export function RoastersSection() {
  const { api, logger } = useDeps();
  const run = useRun();
  const roasters = useRoasters((s) => s.roasters);
  const locked = useConnection((s) => s.connection.status !== 'disconnected');
  const [editingId, setEditingId] = useState<number>();
  const [name, setName] = useState('');
  const [model, setModel] = useState<RoasterModel>('skywalker');
  const editing = roasters.find((r) => r.id === editingId);
  const refused = (error: { kind: string }) => {
    logger.warn('roasters.refused', { ...error });
  };
  const add = () => {
    run('roasters.add-failed', async () => {
      const added = await api.addRoaster({ name: name.trim(), model });
      if (added.ok) {
        setName('');
        setEditingId(added.value.id);
      } else refused(added.error);
    });
  };
  return (
    <section aria-labelledby="roasters-heading" className="flex flex-col gap-3">
      <h2 id="roasters-heading" className="text-heading">
        Roasters
      </h2>
      <ul aria-label="Roaster records" className="flex flex-col gap-2">
        {roasters.map((roaster) => (
          <li
            key={roaster.id}
            className="flex min-h-control-sm items-center gap-2 rounded-md bg-surface px-3.5 py-1"
          >
            <span className="min-w-0 flex-1 truncate text-body">{roaster.name}</span>
            {roaster.active ? <Badge tone="air">Active</Badge> : null}
            {roaster.active || locked ? null : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Use ${roaster.name}`}
                onClick={() => {
                  run('roasters.activate-failed', async () => {
                    const set = await api.setActiveRoaster(roaster.id);
                    if (!set.ok) refused(set.error);
                  });
                }}
              >
                Use
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${roaster.name}`}
              aria-expanded={editingId === roaster.id}
              onClick={() => {
                setEditingId(editingId === roaster.id ? undefined : roaster.id);
              }}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      {locked ? <p className="text-label text-ink-muted">Disconnect to change roasters</p> : null}
      {editing ? (
        <RoasterEditor
          key={editing.id}
          roaster={editing}
          locked={locked}
          onClose={() => {
            setEditingId(undefined);
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="New roaster"
          className="min-w-40 flex-1"
          value={name}
          onChange={setName}
        />
        <SelectField
          label="Model"
          className="min-w-32"
          value={model}
          options={MODELS}
          onChange={setModel}
        />
        <Button disabled={name.trim() === ''} onClick={add}>
          Add
        </Button>
      </div>
    </section>
  );
}
