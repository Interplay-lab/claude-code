# Lunch Money setup

One-shot script to scaffold the Interplay category structure in a fresh Lunch Money account.

## What it creates

9 groups, 30 categories — based on `lunch_money_categorization_guide.txt`.

| Group | Categories |
|---|---|
| Income *(is_income)* | Program Revenue, Event Revenue, Coaching Revenue, Membership / Recurring Revenue, Other Income |
| People | Founder Pay – Peter, Founder Pay – Violet, Contractor Pay, Facilitator Splits, Honoraria & Guest Pay |
| Software & Tools | Software & Subscriptions |
| Event & Program Delivery | Venue Rentals, Event Supplies & Materials |
| Travel & Meals | Air & Long-Distance Transport, Ground Transport, Lodging, Mileage, Business Meals |
| Professional Services | Legal, Accounting, Insurance, Banking & Wire Fees |
| Payment Processing | Stripe Fees, PayPal Fees, Ticket Tailor Fees |
| Other Operating | Equipment & Hardware, One-Time Software, Office / Workspace, Miscellaneous Business |
| Transfers *(excluded from totals + budget)* | Inter-Account Transfers, Owner Draws, Personal |

Tags are not pre-created — Lunch Money has no tag creation endpoint. They get created the first time you apply them to a transaction.

## Run

Requires Python 3 (macOS ships with it). No `pip install` needed — stdlib only.

```bash
export LUNCH_MONEY_API_KEY=your_key_here
python3 setup_categories.py
```

Run it on your Mac, on Lobster, or anywhere with network access to `dev.lunchmoney.app` — it won't run from this Claude sandbox (host blocked).

## Safety

The script verifies API access first, then refuses to run if the account already has any categories. So re-running it on a populated account is a no-op rather than a duplication disaster.

If a single API call fails mid-run, the script prints the offending request + response and exits non-zero. Any groups/categories already created up to that point stay — finish the rest by hand in the Lunch Money UI, or delete what was created and re-run.

## After running

1. Open Lunch Money web → Categories. Confirm the structure looks right.
2. Manually categorize a handful of real transactions to pressure-test the scheme.
3. See `lunch_money_categorization_guide.txt` for tag conventions and decision rules.

## Notes on the guide vs. this script

- The original guide had a `Payroll Run – Gusto` category under People. Dropped — Gusto lump-sum withdrawals are categorized as `Contractor Pay`. Per-person breakdown lives in Airtable.
- The original guide had `Business Meals` as its own group. Folded into `Travel & Meals` alongside the four travel categories.
