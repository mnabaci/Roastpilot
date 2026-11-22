import { isWebLink } from '@roastpilot/shared';
import { Button, Menu } from '@roastpilot/ui';
import { FileText, Globe, Sparkles } from 'lucide-react';
import { siteOf } from './bean-detail';
import type { SpecSheetFill } from './use-spec-sheet-fill';

/**
 * Fill details, quiet, before Cancel in a bean's edit header (docs/spec/beans-favourites-ghost.md,
 * Fill details): with an order link, a menu of where from (the order page, a spec sheet); without
 * one, straight to the spec sheet. Waits, "Reading the page…", while the page is read.
 */
export function FillDetailsButton({ fill, link }: { fill: SpecSheetFill; link: string }) {
  const page = link.trim();
  if (fill.readingPage) {
    return (
      <Button size="sm" variant="ghost" icon={<Sparkles />} disabled>
        Reading the page…
      </Button>
    );
  }
  if (!isWebLink(page)) {
    return (
      <Button size="sm" variant="ghost" icon={<Sparkles />} onClick={fill.show}>
        Fill details
      </Button>
    );
  }
  return (
    <Menu
      label="Fill details"
      text="Fill details"
      quiet={{ icon: <Sparkles /> }}
      items={[
        {
          label: `From the order page · ${siteOf(page)}`,
          icon: <Globe aria-hidden="true" />,
          onSelect: () => {
            fill.fromPage(page);
          },
        },
        {
          label: 'From a spec sheet…',
          icon: <FileText aria-hidden="true" />,
          onSelect: fill.show,
        },
      ]}
    />
  );
}
