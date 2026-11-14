import { Button } from '@roastpilot/ui';
import { LoaderCircle } from 'lucide-react';
import { WaitingButton } from '../../features/WaitingButton';
import type { ConnectControls } from './use-connect-controls';

/** Why Connect waits, or nothing when it can go. */
function connectWaits(connect: ConnectControls): string | undefined {
  if (connect.otherInUse) return `Disconnect ${connect.otherName} first`;
  if (connect.ready || connect.connecting) return undefined;
  return connect.target === null ? 'Choose a port first' : 'Plug the roaster in, then Refresh';
}

/** The page header's Connect, or Disconnect while this roaster is in use. */
export function ConnectButton({ connect }: { connect: ConnectControls }) {
  if (connect.idle || connect.connecting || connect.otherInUse) {
    return (
      <WaitingButton
        reason={connectWaits(connect)}
        size="sm"
        variant="primary"
        disabled={!connect.ready || connect.connecting || connect.otherInUse}
        aria-busy={connect.connecting}
        icon={
          connect.connecting ? (
            <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
          ) : undefined
        }
        onClick={connect.connect}
      >
        {connect.connecting ? 'Connecting…' : 'Connect'}
      </WaitingButton>
    );
  }
  return connect.inUse ? (
    <Button size="sm" onClick={connect.disconnect}>
      Disconnect
    </Button>
  ) : null;
}
