# CollapsibleCard

A card whose content folds away under its header row, which then says in one line what's inside. History's Roast details: bean, weights, rating and notes under the stat cards.

## Anatomy

- **Card**: `surface` fill, `radius-xl`, no border, like every card.
- **Header row**: one full-width button, at least `control-sm` (44px) tall, 8px × 20px padding: the title (`heading`, `ink`), then, folded, the summary (`label`, `ink-muted`, tabular, one line truncated at its end), then a 20px Lucide ChevronDown in `ink-muted` at the right end, turned up while open.
- **Content**: under the header, 20px side and bottom padding, 12px gaps.

## States

- **Open** (the screen picks the default): the summary hides, as the content says it all.
- **Folded**: only the header row, with the summary: `African Moon · 356 → 305 g · 14.3 % · ★★★★★ · Third auto roast curve…`.
- **Hover**: the header row `surface-hover`, corners kept. **Focus**: 2px `focus` ring, inset.

## Rules

- A real `<button>` with `aria-expanded` and `aria-controls` pointing at the content; its name is the title, the summary its description.
- The screen keeps open or folded (History saves it as a setting), not the card.
- The summary lists only the parts that exist, numbers before words; leave it out when there's nothing to say.
