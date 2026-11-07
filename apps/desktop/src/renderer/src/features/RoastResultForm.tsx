import type { RoastResult, RoastSummary } from '@roastpilot/shared';
import { formatNumber, NumberField, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../app/app-context';
import {
  lossHint,
  resultFromDraft,
  weightProblems,
  toResultDraft,
  weightLossPct,
  type ResultDraft,
} from './roast-result';
import { RatingRow } from './RatingRow';
import { useRun } from './use-run';
import { useToast } from './use-toast';
import { useRoasters } from '../stores/use-stores';

const NOT_SAVED = "Couldn't save how it went · try again";
const STATUS_TEXT = { idle: 'Saves as you go', saved: 'Saved', failed: 'Not saved · try again' };

/**
 * Weights, rating, star and notes: all skippable, saved as you enter them (it says Saved when one
 * lands), changeable later (docs/spec/ui.md, After cooling). Key it by roast, as it keeps what you typed.
 */
export function RoastResultForm({ roast }: { roast: RoastSummary }) {
  const { api, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
  const [draft, setDraft] = useState(() => toResultDraft(roast));
  const [rating, setRating] = useState(roast.rating);
  const [isFavourite, setFavourite] = useState(roast.isFavourite);
  // Saved: until the next edit starts. Failed: until a save lands.
  const [saving, setSaving] = useState<'idle' | 'saved' | 'failed'>('idle');
  // Weights are checked against the roaster this roast ran on.
  const roaster = useRoasters((s) => s.roasters.find((r) => r.id === roast.roasterId));
  const limits = { maxBatchG: roaster?.batchMaxG, roasterName: roaster?.name };
  const problems = weightProblems(draft, limits);
  const result = resultFromDraft(draft, { id: roast.id, rating, isFavourite }, limits);
  const save = (next: RoastResult | undefined) => {
    if (!next) return;
    run(
      'roast.result-failed',
      async () => {
        const saved = await api.saveRoastResult(next).catch((error: unknown) => {
          // useRun logs it and shows the toast; this line says it wasn't saved.
          setSaving('failed');
          throw error;
        });
        setSaving(saved.ok ? 'saved' : 'failed');
        if (saved.ok) return;
        logger.warn('roast.result-refused', { id: next.id, error: saved.error });
        toast('error', NOT_SAVED);
      },
      { failed: NOT_SAVED },
    );
  };
  // A weight half-typed doesn't hold up the rating or star: they go with what's saved so far.
  const withSaved = (changes: Pick<RoastResult, 'rating' | 'isFavourite'>): RoastResult => ({
    ...(result ?? {
      id: roast.id,
      batchG: roast.batchG,
      roastedG: roast.roastedG,
      notes: roast.notes,
      rating,
      isFavourite,
    }),
    ...changes,
  });
  const type = (cells: Partial<ResultDraft>) => {
    setSaving((now) => (now === 'saved' ? 'idle' : now));
    setDraft((current) => ({ ...current, ...cells }));
  };
  const commit = () => {
    save(result);
  };
  const loss = weightLossPct(result);
  const unusual = lossHint(loss);
  return (
    <section aria-label="How it went" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Green"
          unit="g"
          value={draft.batch}
          invalid={Boolean(problems.batch)}
          hint={problems.batch}
          onChange={(batch) => {
            type({ batch });
          }}
          onBlur={commit}
        />
        <NumberField
          label="Roasted"
          unit="g"
          value={draft.roasted}
          invalid={Boolean(problems.roasted)}
          hint={problems.roasted}
          onChange={(roasted) => {
            type({ roasted });
          }}
          onBlur={commit}
        />
      </div>
      {loss === undefined ? null : (
        <p className="text-label text-ink-muted tabular-nums">
          {formatNumber(loss, 1)}% weight loss
          {unusual ? ` · ${unusual}` : null}
        </p>
      )}
      <RatingRow
        rating={rating}
        isFavourite={isFavourite}
        onChange={(next) => {
          setRating(next.rating);
          setFavourite(next.isFavourite);
          save(withSaved(next));
        }}
      />
      <TextField
        label="Notes"
        value={draft.notes}
        onChange={(notes) => {
          type({ notes });
        }}
        onBlur={commit}
      />
      <p role="status" className="text-label text-ink-muted">
        {STATUS_TEXT[saving]}
      </p>
    </section>
  );
}
