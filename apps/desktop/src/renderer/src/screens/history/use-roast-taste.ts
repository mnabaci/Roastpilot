import type { RoastReport } from '@roastpilot/core';
import { suggestTasteChange, tasteInput, type TasteSuggestion } from '@roastpilot/core';
import {
  orderedTags,
  type MakeTasteProfileError,
  type RoastDetail,
  type TasteTag,
} from '@roastpilot/shared';
import { useMemo, useRef, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { aiReadMessage } from '../../features/ai-messages';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';

const NOT_SAVED = "Couldn't save the taste · try again";

const MAKE_FAILED: Readonly<Record<MakeTasteProfileError['kind'], string>> = {
  'not-found': 'This roast is gone',
  'no-change': 'Nothing to change any more · the taste changed',
  'bean-not-found': 'Its bean is gone',
  'storage-failed': "Couldn't make the profile · see Logs",
};

/**
 * A roast's taste as you tick it (docs/spec/beans-favourites-ghost.md, Taste): tags saved as you
 * go, your words read into tags, the suggestion worked out here as main will work it out again,
 * and Make <bean> profile. Key the caller by roast, as it keeps what you typed.
 */
export function useRoastTaste(roast: RoastDetail, report: RoastReport | undefined) {
  const { api, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
  const [tags, setTags] = useState<TasteTag[]>(() => orderedTags(roast.tasteTags ?? []));
  const [words, setWords] = useState(roast.tasteWords ?? '');
  /** The words as last saved, so leaving the field unchanged saves nothing. */
  const savedWords = useRef(roast.tasteWords ?? '');
  const [reading, setReading] = useState(false);
  const [making, setMaking] = useState(false);
  /** One line about the last read or make, shown under the field or the suggestion. */
  const [note, setNote] = useState<string>();

  const suggestion: TasteSuggestion | undefined = useMemo(
    () => suggestTasteChange(tasteInput({ ...roast, tasteTags: tags }, report)),
    [roast, report, tags],
  );

  const save = (nextTags: TasteTag[], nextWords: string) => {
    const trimmed = nextWords.trim();
    savedWords.current = trimmed;
    run(
      'history.taste-failed',
      async () => {
        const saved = await api.saveRoastTaste({
          id: roast.id,
          tags: nextTags,
          words: trimmed === '' ? null : trimmed,
        });
        if (saved.ok) return;
        logger.warn('history.taste-refused', { id: roast.id, error: saved.error });
        toast('error', NOT_SAVED);
      },
      { failed: NOT_SAVED },
    );
  };

  const toggle = (tag: TasteTag) => {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : orderedTags([...tags, tag]);
    setTags(next);
    setNote(undefined);
    save(next, words);
  };

  /** Reads your words: only ticks tags, never unticks one you set. */
  const read = () => {
    const typed = words.trim();
    if (typed === '' || reading) return;
    setReading(true);
    setNote(undefined);
    run(
      'history.taste-read-failed',
      async () => {
        try {
          const answer = await api.readTaste({ words: typed });
          if (!answer.ok) {
            setNote(aiReadMessage(answer.error, 'tags'));
            return;
          }
          const next = orderedTags([...tags, ...answer.value]);
          if (answer.value.length === 0) setNote('Nothing to tick from those words');
          setTags(next);
          save(next, typed);
        } finally {
          setReading(false);
        }
      },
      { failed: "Couldn't read your words · try again" },
    );
  };

  const makeProfile = () => {
    if (making) return;
    setMaking(true);
    setNote(undefined);
    run(
      'history.taste-profile-failed',
      async () => {
        try {
          const made = await api.makeTasteProfile({ roastId: roast.id });
          if (!made.ok) {
            logger.info('history.taste-profile-refused', { ...made.error });
            setNote(MAKE_FAILED[made.error.kind]);
            return;
          }
          const next =
            roast.beanId === null ? 'Uses it when you pick it' : 'Next roast of this bean uses it';
          toast('success', `Made ${made.value.profile.name} · ${next}`);
        } finally {
          setMaking(false);
        }
      },
      { failed: "Couldn't make the profile · try again" },
    );
  };

  return {
    tags,
    toggle,
    words,
    setWords,
    /** Keeps your words without reading them, when you leave the field. */
    keepWords: () => {
      if (words.trim() !== savedWords.current) save(tags, words);
    },
    read,
    reading,
    suggestion,
    makeProfile,
    making,
    note,
  };
}
