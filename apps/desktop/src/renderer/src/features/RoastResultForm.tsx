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
import { useRoasters } from '../stores/use-stores';

/**
 * Weights, rating, star and notes: all skippable, saved as you enter them (it says Saved when one
 * lands), changeable later (docs/spec/ui.md, After cooling). Key it by roast, as it keeps what you typed.
 */
export function RoastResultForm({ roast }: { roast: RoastSummary }) {
  const { api } = useDeps();
  const run = useRun();
  const [draft, setDraft] = useState(() => toResultDraft(roast));
  const [rating, setRating] = useState(roast.rating);
  const [isFavourite, setFavourite] = useState(roast.isFavourite);
  const [problem, setProblem] = useState<string>();
  // Says each save landed, until the next edit starts.
  const [justSaved, setJustSaved] = useState(false);
  // Weights are checked against the roaster this roast ran on.
  const roaster = useRoasters((s) => s.roasters.find((r) => r.id === roast.roasterId));
  const limits = { maxBatchG: roaster?.batchMaxG, roasterName: roaster?.name };
  const problems = weightProblems(draft, limits);
  const result = resultFromDraft(draft, { id: roast.id, rating, isFavourite }, limits);
  const save = (next: RoastResult | undefined) => {
    if (!next) return;
    run('roast.result-failed', async () => {
      const saved = await api.saveRoastResult(next);
      setProblem(saved.ok ? undefined : "Couldn't save this · see Logs");
      setJustSaved(saved.ok);
    });
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
    setJustSaved(false);
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
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : (
        <p role="status" className="text-label text-ink-muted">
          {justSaved ? 'Saved' : 'Saves as you go'}
        </p>
      )}
    </section>
  );
}
