# Batch plans and stock

A bean belongs to no roaster, so its stock is grams only. Its batch plan is worked out live for the
active roaster from the green stock left, and never stored: a roast, new stock, an adjustment or
switching roasters re-plans it.

- **The batch it plans around:** the batch its own profile was tuned for, when that profile is one
  of the active roaster's; else the batch of the profile Auto uses; else the roaster's ideal. Kept
  inside the roaster's min–max.
- **Equal batches, always:** as many batches as bring each nearest that weight, each inside
  min–max; the spare grams go in the first. So no batch is left below the minimum while the stock
  allows it. Stock below the minimum is one short batch ("Under one batch · the minimum is
  250 g"); none, no batches.

| Green left | Plans around | Batches                           |
| ---------- | ------------ | --------------------------------- |
| 1,000 g    | 375 g        | 334 · 333 · 333                   |
| 1,784 g    | 356 g        | 360 · 356 · 356 · 356 · 356       |
| 2,270 g    | 375 g        | 380 · 378 · 378 · 378 · 378 · 378 |

- **On the bean:** its Green card says how many batches are left and their weights ("5 batches ·
  4 × 356 g · 1 × 360 g").
- **Add stock:** the weight and the date, and under them what the green then splits into ("Then
  2,784 g green · 8 batches · 8 × 348 g"). Nothing to pick.
- **Batch calculator** (Beans "⋯"): for "what would this order make": the order weight, and the
  batch you'd roast it at (Auto's profile batch, else the roaster's ideal, unless you change it);
  the same equal batches, to scale, and about how much it roasts to. Nothing is saved.
- **The next roast's batch:** picking a bean (or Roast this bean) starts the batch at the first
  batch of its plan; with no green left, at the batch it plans around.
- **Off the profile's batch:** when the batch is more than 10 % from the batch the profile was tuned for (exactly 10 % is fine), one quiet line under it: "Profile tuned for 356 g · a 300 g batch runs hotter and faster" (smaller) or "… a 450 g batch runs cooler and slower" (bigger): the same heat on fewer beans climbs faster. A note, not an error: Preheat and Start stay.

## Stock

- Green stock per bean drops by the batch weight at Start.
- After cooling, the app asks for the roasted weight and logs weight loss % and roasted stock.
- Low-stock badge below a threshold (default 500 g). Adjust by hand any time.
- Skipping the roasted weight is fine: the roast shows no weight loss and roasted stock doesn't change.
- A bean's average weight loss comes from its roasts with a roasted weight; 15% until it has one.
- A batch bigger than the green stock left is allowed, with a one-line warning, as your count may be off; stock stops at 0.
- Clear after a finished roast can give its batch back to the green stock: it goes back on top of what is there, never in place of it.

## Stock history

Each bean has its own, whichever roaster or profile roasted it: how much and how often it is bought and used.

- **What counts:** purchases (Add stock: grams and the day bought), roasts made here (the batch off green at Start; an imported roast never touched stock, so it isn't here), and adjustments: Adjust stock keeps what it changed ("Counted"), Take out stock what you took and why ("Taken out · …"), and a batch given back at Clear is "Returned at Clear". An adjustment that changes nothing isn't kept.
- **Green after each:** worked back from today's green stock, so today's is always right; when older records are missing (a deleted roast, stock set before adjustments were kept), the oldest steps are what's off. Never below 0.
- **Card:** "Stock history" on the bean page, under the stock cards, folded by default with one line: "Bought twice · 360 g a week" (or "3 roasts", or "Nothing yet"). Open, it shows:
  - **Facts:** Bought (times · grams), Roasted (roasts · green grams), Pace (green a week from the first roast to today, once there are two weeks of roasting), Lasts (the green left at that pace: "About 3 weeks", "Under a week", months past 12 weeks). A dash where there's nothing yet.
  - **Chart:** the green stock as steps from the first movement to today, with the low-stock line (design system: StockChart). Hover shows each movement.
  - **Movements:** Date · What · Green (+/− grams) · Green after, newest first; six, then Show all.

## Take out stock

Green beans that leave the bag for any reason but a roast: given away, spilled, a sample for a friend. On the bean page's ⋯ menu, above Adjust stock (greyed out with no green left).

- **Form:** Weight (g) and Why (optional, up to 120 characters, "Gave some to a friend"), then "Then 1,384 g green". More than the green stock is refused under the field: "Only 1,784 g green left". The primary reads "Take out 400 g".
- **Kept:** as an adjustment with reason `taken` and your words; Stock history shows it as "Taken out · Gave some to a friend". Roasted stock doesn't move.
