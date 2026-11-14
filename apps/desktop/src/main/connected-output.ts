import type { ConnectionState } from '@roastpilot/shared';

/**
 * Whether the connected roaster has output `channel`: a generic TC4 has no cooler or drum. When
 * none is connected the command goes ahead, and the session refuses it as it does any other.
 */
export function connectedHasOutput(connection: ConnectionState, channel: string): boolean {
  return (
    connection.status !== 'connected' ||
    connection.channels.some((c) => c.id === channel && c.kind === 'output')
  );
}
