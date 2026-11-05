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

## Stock

- Green stock per bean drops by the batch weight at Start.
- After cooling, the app asks for the roasted weight and logs weight loss % and roasted stock.
- Low-stock badge below a threshold (default 500 g). Adjust by hand any time.
- Skipping the roasted weight is fine: the roast shows no weight loss and roasted stock doesn't change.
- A bean's average weight loss comes from its roasts with a roasted weight; 15% until it has one.
- A batch bigger than the green stock left is allowed, with a one-line warning, as your count may be off; stock stops at 0.
