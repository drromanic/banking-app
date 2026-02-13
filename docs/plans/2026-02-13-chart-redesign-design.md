# Chart Redesign: Spending Overview Card

## Summary

Replace the single monthly bar chart with a stacked card containing three sections: monthly bars, trend banner, and category horizontal bars. All custom CSS — no charting library.

## Layout

Single white card, three sections stacked vertically:

### 1. Monthly Bars (existing — keep as-is)

- Clean vertical bars, one per month, click to select
- Selected month highlighted in brand indigo, others muted grey
- Header: eyebrow label + month name on left, big total on right
- When a category is expanded, bars filter to that category's spending

### 2. Trend Banner (new)

- Single line between the two chart sections
- Shows: `+8.2% vs last month  ·  2 categories above average`
- Green text for decrease (spending down = good), red for increase
- Computed from: current month total vs previous month total, and per-category 3-month rolling average comparison

### 3. Category Horizontal Bars (new)

- Horizontal bars for the selected month, sorted by highest spend
- Each row: color dot, category name, proportional bar, amount, trend arrow + %, optional warning indicator
- Trend arrow: % change vs previous month (green down-arrow, red up-arrow, grey dash for ~0%)
- Warning indicator: shown when category spend exceeds its 3-month rolling average
- Click a category row to expand it in the breakdown table below AND filter the monthly bars to that category (reuses existing `expandedCategory` interaction)

## Data Requirements

All data already available from `includedTransactions`:

- `monthlyTotals` — already computed
- Per-category totals for selected month — already computed as `catTotals`
- Previous month totals — derive from `monthlyTotals[activeMonthIndex - 1]`
- Per-category previous month — compute from `includedTransactions` filtered to previous month
- 3-month rolling average per category — compute from last 3 months of `includedTransactions`

## Interactions

- Click monthly bar → select that month (existing)
- Click category bar → sets `expandedCategory`, filters monthly bars and transaction table (existing)
- Click "All Categories" back row in breakdown table → clears expanded category (existing)

## Files Changed

- `src/App.js` — add trend/category bar data computation + JSX
- `src/App.css` — add trend banner and horizontal bar styles
