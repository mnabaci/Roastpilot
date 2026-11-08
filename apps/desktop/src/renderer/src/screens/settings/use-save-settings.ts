import type { Settings } from '@roastpilot/shared';
import { useCallback } from 'react';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';
import { useDeps } from '../../app/app-context';

const NOT_SAVED = "Couldn't save settings · kept until you quit";

/**
 * Saves a change to the settings and keeps what main actually saved, unless another change came
 * since; `notSaved` is its error toast.
 */
export function useSaveSettings(notSaved = NOT_SAVED): (change: Partial<Settings>) => void {
  const { api, stores, logger } = useDeps();
  const store = stores.settings;
  const run = useRun();
  const toast = useToast();
  return useCallback(
    (change) => {
      const next = { ...store.getState().settings, ...change };
      store.setState({ settings: next });
      run(
        'settings.save-failed',
        async () => {
          const saved = await api.setSettings(next);
          if (saved.ok) {
            // Only while this is still the latest change: a slower answer to an earlier save
            // must not undo a switch flipped since.
            if (store.getState().settings === next) store.setState({ settings: saved.value });
            return;
          }
          // Kept in memory for this session; the file write is what failed.
          logger.warn('settings.not-saved', { error: saved.error });
          toast('error', notSaved);
        },
        { failed: notSaved },
      );
    },
    [api, store, logger, run, toast, notSaved],
  );
}
