import type { RoastReport } from '@roastpilot/core';
import {
  TASTE_TAG_LABELS,
  TASTE_TAGS,
  TASTE_WORDS_MAX,
  type RoastDetail,
} from '@roastpilot/shared';
import { Button, TextField } from '@roastpilot/ui';
import { Lightbulb } from 'lucide-react';
import { ChipGroup } from '../../features/ChipGroup';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { suggestionText } from './taste-format';
import { useRoastTaste } from './use-roast-taste';

const CHIPS = TASTE_TAGS.map((id) => ({ id, label: TASTE_TAG_LABELS[id] }));

/**
 * Taste in History's Roast details (docs/spec/beans-favourites-ghost.md, Taste): tags to tick,
 * your words read into tags when the AI helpers can, and one suggestion for the next roast.
 * Key it by roast.
 */
export function TasteSection({
  roast,
  report,
  beanName,
  canRead,
}: {
  roast: RoastDetail;
  report: RoastReport | undefined;
  /** The roast's bean, for "Make <bean> profile"; undefined without one. */
  beanName: string | undefined;
  /** The AI helpers are on with a key that reads tasting words. */
  canRead: boolean;
}) {
  const unit = useTemperatureUnit();
  const taste = useRoastTaste(roast, report);
  const shown = taste.suggestion ? suggestionText(taste.suggestion, unit) : undefined;
  return (
    // One name for screen readers, the chips' group: the visible "Taste" is that name, shown.
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="text-label text-ink-muted">
          Taste
        </span>
        <ChipGroup
          label="Taste"
          chips={CHIPS}
          isOn={(tag) => taste.tags.includes(tag)}
          onToggle={taste.toggle}
        />
      </div>
      {canRead ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            taste.read();
          }}
        >
          <TextField
            label="In your words"
            className="min-w-0 flex-1"
            placeholder="tart, a bit hay-like"
            maxLength={TASTE_WORDS_MAX}
            value={taste.words}
            onChange={taste.setWords}
            onBlur={taste.keepWords}
          />
          <Button size="sm" type="submit" disabled={taste.reading || taste.words.trim() === ''}>
            {taste.reading ? 'Reading…' : 'Read'}
          </Button>
        </form>
      ) : null}
      {shown ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2">
            <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
            <span className="flex min-w-0 flex-col">
              {shown.change ? (
                <span className="text-body font-semibold text-ink tabular-nums">
                  {shown.change}
                </span>
              ) : null}
              <span className="text-label text-ink-muted">{shown.line}</span>
            </span>
          </p>
          {taste.suggestion?.kind === 'change' ? (
            <Button size="sm" disabled={taste.making} onClick={taste.makeProfile}>
              {beanName ? `Make ${beanName} profile` : 'Make profile'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {taste.note ? (
        <p role="status" className="text-label text-ink-muted">
          {taste.note}
        </p>
      ) : null}
    </div>
  );
}
