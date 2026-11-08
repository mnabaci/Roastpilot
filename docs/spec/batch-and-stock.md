# Batch calculator and stock

Enter an order's weight; the calculator uses the active roaster's batch sizes and shows two plans
side by side. You pick one, and it's saved with the bean purchase.

| Order   | Equal splits     | Ideal + leftover             |
| ------- | ---------------- | ---------------------------- |
| 1,000 g | 3 × 333 g (+1 g) | 2 × 375 g + 250 g            |
| 2,270 g | 6 × 378 g (+2 g) | 6 × 375 g + 20 g (below min) |

- **Equal splits:** batch count = order ÷ ideal, rounded, kept inside min–max; spare grams go into the first batch.
- **Ideal + leftover:** as many ideal batches as fit, plus the rest; flagged if the rest is below the minimum.
- Both plans show expected roasted output, using the bean's average weight loss (default 15%).
- Runs automatically when you add a bean or new stock, and as a standalone tool.
- **The next roast's batch:** picking a bean (or Roast this bean) starts the batch at the bean's next planned batch; without a plan, at the batch the profile the roast follows was tuned for (Auto's, or the coach's in Manual); with neither, at the roaster's ideal.
- **Off the profile's batch:** when the batch is more than 10 % from the batch the profile was tuned for (exactly 10 % is fine), one quiet line under it: "Profile tuned for 385 g · a 300 g batch runs hotter and faster" (smaller) or "… a 450 g batch runs cooler and slower" (bigger): the same heat on fewer beans climbs faster. A note, not an error: Preheat and Start stay.

## Stock

- Green stock per bean drops by the batch weight at Start.
- After cooling, the app asks for the roasted weight and logs weight loss % and roasted stock.
- Low-stock badge below a threshold (default 500 g). Adjust by hand any time.
- Skipping the roasted weight is fine: the roast shows no weight loss and roasted stock doesn't change.
- A bean's average weight loss comes from its roasts with a roasted weight; 15% until it has one.
- A batch bigger than the green stock left is allowed, with a one-line warning, as your count may be off; stock stops at 0.
