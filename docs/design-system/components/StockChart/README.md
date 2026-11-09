# StockChart

A bean's green stock over time, as steps: flat between purchases and roasts, up when a bag comes in, down by each batch. On the Beans screen, inside the bean's Stock history card.

## Anatomy

- **Plot**: 160px tall, the card's full width. The stock is one 2px `air` line with an `air-tint` area under it down to 0. It steps (never slopes) because stock only changes at an event, and runs on to today.
- **Low-stock line**: the bean's low-stock line, dashed 1px `heat`, labelled at its right end in `label` `ink-muted` ("Low 500 g"). Left out when it is 0.
- **Grid**: only the baseline and the top value, 1px `chart-grid`. The top value and 0 sit at the left in `label` `ink-muted`; the first date and "Today" sit under the ends.
- **Hover**: a 1px `border-strong` cursor follows the pointer, with an 8px `air` dot (2px `surface` ring) on the line and a tooltip card: the date, what moved the stock ("Roasted · −400 g"), and the green after it. The tooltip flips to the cursor's left past the middle.

## Rules

- One series, so no legend: the card's title names it.
- Text stays `ink` and `ink-muted`; colour is only on the line, its dot and the low-stock line.
- The plot is a picture (`role="img"` with a one-line summary); the event list beside it is the table view that screen readers and keyboards use.
- Fewer than one movement shows nothing: the card says there is no history yet.
