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
