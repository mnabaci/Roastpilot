import { ok, type Unsubscribe } from '@roastpilot/shared';

// The quiet answers the fake gives: listeners never hear anything, actions say they worked.

const NOTHING: Unsubscribe = () => undefined;
export const listening = (): Unsubscribe => NOTHING;
export const done = () => Promise.resolve();
export const accepted = () => Promise.resolve(ok(undefined));
export const cancelled = () => Promise.resolve(ok({ status: 'cancelled' as const }));
