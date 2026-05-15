#!/usr/bin/env python3
"""
Create the Interplay category groups and categories in a fresh Lunch Money account.

Run:
    export LUNCH_MONEY_API_KEY=your_key_here
    python3 setup_categories.py

Safety: aborts if the account already has any categories.
"""

import json
import os
import sys
import urllib.error
import urllib.request

API_BASE = "https://dev.lunchmoney.app/v1"


# Group definitions. is_income / exclude_from_totals / exclude_from_budget here
# set the GROUP-level defaults. Per-category overrides go in CATEGORIES below.
GROUPS = [
    {"name": "Income", "is_income": True},
    {"name": "People"},
    {"name": "Software & Tools"},
    {"name": "Event & Program Delivery"},
    {"name": "Travel & Meals"},
    {"name": "Professional Services"},
    {"name": "Payment Processing"},
    {"name": "Other Operating"},
    {"name": "Transfers", "exclude_from_totals": True, "exclude_from_budget": True},
]


# Category definitions. group is the GROUPS["name"] this category belongs in.
# Flags repeat the group-level intent at the category level so behavior is
# explicit regardless of whether Lunch Money inherits or not.
CATEGORIES = [
    # Income
    {"name": "Program Revenue", "group": "Income", "is_income": True},
    {"name": "Event Revenue", "group": "Income", "is_income": True},
    {"name": "Coaching Revenue", "group": "Income", "is_income": True},
    {"name": "Membership / Recurring Revenue", "group": "Income", "is_income": True},
    {"name": "Other Income", "group": "Income", "is_income": True},

    # People
    {"name": "Founder Pay – Peter", "group": "People"},
    {"name": "Founder Pay – Violet", "group": "People"},
    {"name": "Contractor Pay", "group": "People"},
    {"name": "Facilitator Splits", "group": "People"},
    {"name": "Honoraria & Guest Pay", "group": "People"},

    # Software & Tools
    {"name": "Software & Subscriptions", "group": "Software & Tools"},

    # Event & Program Delivery
    {"name": "Venue Rentals", "group": "Event & Program Delivery"},
    {"name": "Event Supplies & Materials", "group": "Event & Program Delivery"},

    # Travel & Meals
    {"name": "Air & Long-Distance Transport", "group": "Travel & Meals"},
    {"name": "Ground Transport", "group": "Travel & Meals"},
    {"name": "Lodging", "group": "Travel & Meals"},
    {"name": "Mileage", "group": "Travel & Meals"},
    {"name": "Business Meals", "group": "Travel & Meals"},

    # Professional Services
    {"name": "Legal", "group": "Professional Services"},
    {"name": "Accounting", "group": "Professional Services"},
    {"name": "Insurance", "group": "Professional Services"},
    {"name": "Banking & Wire Fees", "group": "Professional Services"},

    # Payment Processing
    {"name": "Stripe Fees", "group": "Payment Processing"},
    {"name": "PayPal Fees", "group": "Payment Processing"},
    {"name": "Ticket Tailor Fees", "group": "Payment Processing"},

    # Other Operating
    {"name": "Equipment & Hardware", "group": "Other Operating"},
    {"name": "One-Time Software", "group": "Other Operating"},
    {"name": "Office / Workspace", "group": "Other Operating"},
    {"name": "Miscellaneous Business", "group": "Other Operating"},

    # Transfers
    {
        "name": "Inter-Account Transfers",
        "group": "Transfers",
        "exclude_from_totals": True,
        "exclude_from_budget": True,
    },
    {
        "name": "Owner Draws",
        "group": "Transfers",
        "exclude_from_totals": True,
        "exclude_from_budget": True,
    },
    {
        "name": "Personal",
        "group": "Transfers",
        "exclude_from_totals": True,
        "exclude_from_budget": True,
    },
]


def api(method, path, token, body=None):
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")
        print(f"\n  HTTP {e.code} on {method} {path}", file=sys.stderr)
        print(f"  Response body: {body_text}", file=sys.stderr)
        if body is not None:
            print(f"  Request body: {json.dumps(body)}", file=sys.stderr)
        raise SystemExit(1)


def main():
    token = os.environ.get("LUNCH_MONEY_API_KEY")
    if not token:
        sys.exit("LUNCH_MONEY_API_KEY not set")

    print("Verifying API access...")
    me = api("GET", "/me", token)
    print(f"  Authenticated as: {me.get('user_email')} ({me.get('user_name')})")
    print(f"  Account: {me.get('account_id')}, budget currency: {me.get('primary_currency')}")

    print("\nChecking for existing categories...")
    existing = api("GET", "/categories", token).get("categories", [])
    non_group_existing = [c for c in existing if not c.get("is_group")]
    if non_group_existing:
        print(f"  Found {len(non_group_existing)} existing categories. Aborting to avoid duplicates.")
        print("  Existing category names:")
        for c in non_group_existing:
            print(f"    - {c['name']} (id={c['id']})")
        sys.exit(1)
    print("  Empty. Proceeding.")

    print(f"\nCreating {len(GROUPS)} category groups...")
    group_ids = {}
    for g in GROUPS:
        body = {"name": g["name"]}
        for flag in ("is_income", "exclude_from_totals", "exclude_from_budget"):
            if g.get(flag):
                body[flag] = True
        resp = api("POST", "/categories/group", token, body)
        # POST /categories/group returns the new group_id as a bare integer
        # or {"category_id": id} depending on API version. Handle both.
        gid = resp if isinstance(resp, int) else resp.get("category_id") or resp.get("id")
        if gid is None:
            print(f"  Unexpected response creating group {g['name']}: {resp}", file=sys.stderr)
            sys.exit(1)
        group_ids[g["name"]] = gid
        print(f"  [{gid}] {g['name']}")

    print(f"\nCreating {len(CATEGORIES)} categories...")
    created = []
    for c in CATEGORIES:
        body = {"name": c["name"], "group_id": group_ids[c["group"]]}
        for flag in ("is_income", "exclude_from_totals", "exclude_from_budget"):
            if c.get(flag):
                body[flag] = True
        resp = api("POST", "/categories", token, body)
        cid = resp if isinstance(resp, int) else resp.get("category_id") or resp.get("id")
        if cid is None:
            print(f"  Unexpected response creating category {c['name']}: {resp}", file=sys.stderr)
            sys.exit(1)
        created.append((cid, c["name"], c["group"]))
        print(f"  [{cid}] {c['name']}  →  {c['group']}")

    print(f"\nDone. {len(group_ids)} groups, {len(created)} categories.")
    print("Tags are not pre-created; they'll be created on first apply.")


if __name__ == "__main__":
    main()
