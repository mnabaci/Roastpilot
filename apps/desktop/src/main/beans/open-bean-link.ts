import { serializeError, type Logger } from '@roastpilot/core';
import {
  err,
  isWebLink,
  ok,
  type BeanId,
  type OpenBeanLinkError,
  type Result,
} from '@roastpilot/shared';
import type { BeanService } from './bean-service';

export interface OpenBeanLinkDeps {
  beans: Pick<BeanService, 'read'>;
  /** Electron's shell.openExternal. */
  openExternal: (url: string) => Promise<void>;
  logger: Logger;
}

/**
 * Opens a bean's order link in the browser (docs/spec/beans-favourites-ghost.md). The address is
 * the one saved with the bean, read here, never taken from the renderer, and only http or https.
 */
export async function openBeanLink(
  id: BeanId,
  { beans, openExternal, logger }: OpenBeanLinkDeps,
): Promise<Result<void, OpenBeanLinkError>> {
  const all = await beans.read();
  if (!all.ok) {
    return err({
      kind: 'storage-failed',
      message: all.error.kind === 'storage-failed' ? all.error.message : 'not found',
    });
  }
  const bean = all.value.find((b) => b.id === id);
  if (!bean) return err({ kind: 'bean-not-found', id });
  if (bean.link === null || !isWebLink(bean.link)) {
    logger.warn('beans.link-refused', { id });
    return err({ kind: 'no-link', id });
  }
  try {
    await openExternal(bean.link);
    return ok(undefined);
  } catch (error) {
    logger.error('beans.link-failed', { id, error: serializeError(error) });
    return err({ kind: 'open-failed' });
  }
}
