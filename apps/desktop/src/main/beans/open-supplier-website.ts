import { serializeError, type Logger } from '@roastpilot/core';
import {
  err,
  isWebLink,
  ok,
  type OpenSupplierWebsiteError,
  type Result,
  type SupplierId,
} from '@roastpilot/shared';
import type { SupplierService } from './supplier-service';

export interface OpenSupplierWebsiteDeps {
  suppliers: Pick<SupplierService, 'read'>;
  /** Electron's shell.openExternal. */
  openExternal: (url: string) => Promise<void>;
  logger: Logger;
}

/**
 * Opens a supplier's website in the browser (docs/spec/beans-favourites-ghost.md, Suppliers). The
 * address is the one saved with the supplier, read here, never taken from the renderer, and only
 * http or https.
 */
export async function openSupplierWebsite(
  id: SupplierId,
  { suppliers, openExternal, logger }: OpenSupplierWebsiteDeps,
): Promise<Result<void, OpenSupplierWebsiteError>> {
  const all = await suppliers.read();
  if (!all.ok) {
    return err({
      kind: 'storage-failed',
      message: all.error.kind === 'storage-failed' ? all.error.message : 'not found',
    });
  }
  const supplier = all.value.find((s) => s.id === id);
  if (!supplier) return err({ kind: 'supplier-not-found', id });
  if (supplier.website === null || !isWebLink(supplier.website)) {
    logger.warn('suppliers.website-refused', { id });
    return err({ kind: 'no-website', id });
  }
  try {
    await openExternal(supplier.website);
    return ok(undefined);
  } catch (error) {
    logger.error('suppliers.website-failed', { id, error: serializeError(error) });
    return err({ kind: 'open-failed' });
  }
}
