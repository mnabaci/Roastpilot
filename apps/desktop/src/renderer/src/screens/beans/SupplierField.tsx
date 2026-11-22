import { supplierNamed } from '@roastpilot/shared';
import { SelectField } from '@roastpilot/ui';
import { useBeans } from '../../stores/use-stores';
import { supplierOptions } from './supplier-options';

/**
 * A bean's Supplier in Edit: one of your suppliers, or a new one added from what you typed
 * (docs/spec/beans-favourites-ghost.md, Suppliers). A new name is saved with the bean.
 */
export function SupplierField({
  value,
  onChange,
  error,
  className,
}: {
  /** The supplier's name as the draft has it; empty for none. */
  value: string;
  onChange: (name: string) => void;
  error: string | undefined;
  className?: string;
}) {
  const suppliers = useBeans((s) => s.suppliers);
  const { options, value: picked, isNew } = supplierOptions(suppliers, value);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <SelectField
        label="Supplier"
        value={picked}
        options={options}
        onChange={onChange}
        hint={isNew && !error ? 'New supplier · added when you save' : undefined}
        create={{
          label: (typed) => `Add supplier "${typed}"`,
          // A name you have in another case is that supplier.
          onCreate: (typed) => {
            onChange(supplierNamed(suppliers, typed)?.name ?? typed);
          },
        }}
      />
      {error ? <p className="text-label text-critical-text">{error}</p> : null}
    </div>
  );
}
