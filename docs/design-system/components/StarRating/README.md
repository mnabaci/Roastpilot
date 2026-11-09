# StarRating

A roast's rating, 1–5, as five stars: in History's list, the bean's roasts table, Compare, and as the picker in Roast details.

## Anatomy

- **Shown**: five 14px Lucide Stars, 1px apart, inline with the text around them. Filled `ink` up to the rating, outlined `border-strong` after. No rating: "–" in `ink-muted`, as tables show a missing value. The 14px stars are the brand book's one exception to 20px icons: they sit inline in `label` text.
- **Picker**: five 44px (`control-sm`) square buttons, each a 24px star; filled `ink` up to the rating, outlined `border-strong` after.

## States

- **Hover** (picker): `surface-hover` behind the star, an empty star darkens to `ink-muted`. **Focus**: 2px `focus` ring, inset.
- **Chosen**: `aria-pressed` on the star that sets the rating. Pressing it again clears the rating.

## Rules

- Stars in `ink`, never `heat`: the heat star is the favourite, a separate toggle beside the picker.
- Shown, it is one image named "Rated 4 of 5" (or "Not rated"), never five stars read out.
- The picker is a group named "Rating"; each star is named "1 star", "2 stars"…
- In a row that can be narrow, the stars keep their size and the text before them truncates.
