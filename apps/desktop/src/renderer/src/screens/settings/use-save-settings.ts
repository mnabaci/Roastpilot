import type { Settings } from '@roastpilot/shared';
import { useCallback } from 'react';
import { useRun } from '../../hooks/use-run';
import { useDeps } from '../../state/app-context';

/** Saves a change to the settings and keeps what main actually saved. */
export function useSaveSettings(): (change: Partial<Settings>) => void {
  const { api, store, logger } = useDeps();
  const run = useRun();
  return useCallback(
    (change) => {
      const next = { ...store.getState().settings, ...change };
      store.setState({ settings: next });
      run('settings.save-failed', async () => {
        const saved = await api.setSettings(next);
        if (saved.ok) store.setState({ settings: saved.value });
        // Kept in memory for this session; the file write is what failed.
        else logger.warn('settings.not-saved', { error: saved.error });
      });
    },
    [api, store, logger, run],
  );
}
