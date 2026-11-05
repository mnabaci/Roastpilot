import type { RoastResult, RoastSummary } from '@roastpilot/shared';
import { Button, formatNumber, NumberField, TextField } from '@roastpilot/ui';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../app/app-context';
import { resultFromDraft, toResultDraft, weightLossPct, type ResultDraft } from './roast-result';
import { useRun } from './use-run';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Weights, rating, star and notes: all skippable, saved as you enter them, changeable later
 * (docs/spec/ui.md, After cooling). Key it by roast, as it keeps what you typed.
 */
export function RoastResultForm({ roast }: { roast: RoastSummary }) {
  const { api } = useDeps();
  const run = useRun();
  const [draft, setDraft] = useState(() => toResultDraft(roast));
  const [rating, setRating] = useState(roast.rating);
  const [isFavourite, setFavourite] = useState(roast.isFavourite);
  const [problem, setProblem] = useState<string>();
  const result = resultFromDraft(draft, { id: roast.id, rating, isFavourite });
  const save = (next: RoastResult | undefined) => {
    if (!next) return;
    run('roast.result-failed', async () => {
      const saved = await api.saveRoastResult(next);
      setProblem(saved.ok ? undefined : "Couldn't save this · see Logs");
    });
  };
  const type = (cells: Partial<ResultDraft>) => {
    setDraft((current) => ({ ...current, ...cells }));
  };
  const commit = () => {
    save(result);
  };
  const loss = weightLossPct(result);
  return (
    <section aria-label="How it went" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Green"
          unit="g"
          value={draft.batch}
          onChange={(batch) => {
            type({ batch });
          }}
          onBlur={commit}
        />
        <NumberField
          label="Roasted"
          unit="g"
          value={draft.roasted}
          onChange={(roasted) => {
            type({ roasted });
          }}
          onBlur={commit}
        />
      </div>
      {loss === undefined ? null : (
        <p className="text-label text-ink-muted tabular-nums">
          {formatNumber(loss, 1)}% weight loss
        </p>
      )}
      <div className="flex items-center gap-1">
        <div role="group" aria-label="Rating" className="flex gap-1">
          {RATINGS.map((value) => (
            <Button
              key={value}
              size="sm"
              aria-pressed={rating === value}
              className={rating === value ? 'bg-heat-tint text-heat' : undefined}
              onClick={() => {
                const next = rating === value ? null : value;
                setRating(next);
                save(result && { ...result, rating: next });
              }}
            >
              {value}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Favourite"
          aria-pressed={isFavourite}
          className={isFavourite ? 'text-heat' : 'text-ink-muted'}
          icon={<Star aria-hidden="true" fill={isFavourite ? 'currentColor' : 'none'} />}
          onClick={() => {
            setFavourite(!isFavourite);
            save(result && { ...result, isFavourite: !isFavourite });
          }}
        />
      </div>
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
      ) : null}
    </section>
  );
}
