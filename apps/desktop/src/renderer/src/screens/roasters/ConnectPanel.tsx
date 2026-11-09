import { Button, cn } from '@roastpilot/ui';
import { RefreshCw } from 'lucide-react';
import { targetLabel } from '../../app/connection-label';
import { PortPicker } from './PortPicker';
import { sameTarget } from './roaster-rows';
import type { ConnectControls } from './use-connect-controls';

const STATE_TEXT = { connecting: 'Connecting…', connected: 'Connected', lost: 'Reconnecting…' };
/** The same colours as the Roasters tab's dot: grey off, air connected, ember on the way. */
const DOT = { connecting: 'bg-heat', connected: 'bg-air', lost: 'bg-heat' };

/**
 * One roaster's connection as a single card (docs/spec/ui.md, Roasters screen): how it stands and
 * on which port. The port list opens in it only to choose one. Connect is the page header's.
 */
export function ConnectPanel({ controls }: { controls: ConnectControls }) {
  const c = controls;
  const live = c.inUse && c.connection.status !== 'disconnected' ? c.connection.status : undefined;
  const state = c.otherInUse
    ? `Disconnect ${c.otherName} to switch`
    : live
      ? STATE_TEXT[live]
      : c.connecting
        ? 'Connecting…'
        : c.target === null
          ? 'No port chosen'
          : 'Not connected';
  const shownRow = c.rows.find((row) => sameTarget(c.shownTarget, row.target));
  const port = c.isSimulator
    ? 'Built in · practice without a roaster'
    : c.shownTarget
      ? [targetLabel(c.shownTarget), shownRow?.detail].filter(Boolean).join(' · ')
      : 'No port';
  const listing = !c.isSimulator && c.choosing && !c.otherInUse;
  return (
    <section
      aria-label="Connection"
      className="flex flex-col gap-3 rounded-xl bg-surface px-5 py-3"
    >
      <div className="flex min-h-control-sm items-center gap-3">
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', live ? DOT[live] : 'bg-ink-muted')}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-body text-ink" aria-live="polite">
            {state}
          </p>
          {listing ? null : <p className="truncate text-label text-ink-muted">{port}</p>}
        </div>
        {!c.isSimulator && c.idle && !c.choosing && c.target !== null && !c.otherInUse ? (
          <Button variant="ghost" size="sm" onClick={c.chooseAnother}>
            Change port
          </Button>
        ) : null}
        {!c.isSimulator && !c.inUse && !c.otherInUse ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Refresh ports"
            icon={<RefreshCw aria-hidden="true" />}
            disabled={!c.idle}
            onClick={c.refresh}
          />
        ) : null}
      </div>
      {listing ? (
        <PortPicker
          rows={c.rows}
          shown={c.shownTarget}
          hidden={c.view.hidden}
          idle={c.idle}
          onSelect={c.select}
          onShowAll={c.showAll}
        />
      ) : null}
      {c.error ? (
        <p role="alert" className="text-label text-critical-text">
          {c.error}
        </p>
      ) : c.hint ? (
        <p className="text-label text-ink-muted">{c.hint}</p>
      ) : null}
    </section>
  );
}
