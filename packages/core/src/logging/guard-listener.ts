import type { Logger } from './logger';
import { serializeError } from './serialize-error';

/**
 * Wraps a caller's listener so a throw is logged as `event` instead of breaking the loop that
 * called it (polling, safety, the roast flow).
 */
export function guardListener<T>(
  logger: Logger,
  event: string,
  listener: (payload: T) => void,
  context: Record<string, unknown> = {},
): (payload: T) => void {
  return (payload) => {
    try {
      listener(payload);
    } catch (error) {
      logger.error(event, { ...context, error: serializeError(error) });
    }
  };
}
