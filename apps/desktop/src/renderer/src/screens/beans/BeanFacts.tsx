import type { Bean } from '@roastpilot/shared';

const facts = (bean: Bean): readonly [string, string | null][] => [
  ['Origin', bean.origin],
  ['Process', bean.process],
  ['Variety', bean.variety],
  ['Density', bean.densityGL === null ? null : `${String(bean.densityGL)} g/L`],
  ['Altitude', bean.altitudeM === null ? null : `${String(bean.altitudeM)} m`],
  ['Moisture', bean.moisturePct === null ? null : `${String(bean.moisturePct)} %`],
  ['Bean size', bean.screen === null ? null : `Screen ${String(bean.screen)}`],
  ['Decaf', bean.decaf ? 'Yes' : null],
  ['Supplier', bean.supplier],
  ['Notes', bean.notes],
];

/** What the record says; an empty field isn't listed. */
export function BeanFacts({ bean }: { bean: Bean }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
      {facts(bean).flatMap(([label, value]) =>
        value === null
          ? []
          : [
              <dt key={label} className="text-ink-muted">
                {label}
              </dt>,
              <dd key={`${label}-value`} className="first-letter:uppercase">
                {value}
              </dd>,
            ],
      )}
    </dl>
  );
}
