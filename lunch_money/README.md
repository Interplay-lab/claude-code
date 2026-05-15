# Lunch Money setup

Two equivalent paths to scaffold the Interplay category structure in a fresh Lunch Money account. The categories were created on 2026-05-15 via the **Make.com** path (Path B below); the standalone Python script (Path A) is kept as a fallback / reference.

## What gets created

9 groups, 32 categories — based on `lunch_money_categorization_guide.txt`.

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

## Path A: Standalone Python script

Requires Python 3 (macOS ships with it). No `pip install` needed — stdlib only.

```bash
export LUNCH_MONEY_API_KEY=your_key_here
python3 setup_categories.py
```

The script verifies API access first, then refuses to run if the account already has any categories — re-running on a populated account is a no-op rather than a duplication disaster.

## Path B: Make.com scenario *(used in production)*

`build_make_blueprint.py` generates a Make scenario blueprint with 41 modules (9 group-creates + 32 category-creates, each referencing its parent group via `{{N.id}}` expressions). The generated blueprint is checked in as `make_blueprint.json`.

The blueprint was loaded into Make scenario **"ONE-OFF: Lunch Money Category Setup"** (id `5072387`, team `1815706`, app `app#lunchmoney-65tvqd`, connection `8882969`), activated, run on-demand, and deactivated after a successful run (41 ops in 3.2 seconds, all SUCCESS).

To regenerate the blueprint after editing the category list:

```bash
python3 build_make_blueprint.py    # writes make_blueprint.json
```

Then update the scenario in Make (UI: "Edit blueprint") or via the Make MCP `scenarios_update` tool.

## Notes on the guide vs. this implementation

- The original guide had a `Payroll Run – Gusto` category under People. Dropped — Gusto lump-sum withdrawals are categorized as `Contractor Pay`. Per-person breakdown lives in Airtable.
- The original guide had `Business Meals` as its own group. Folded into `Travel & Meals` alongside the four travel categories.
