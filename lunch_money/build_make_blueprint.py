#!/usr/bin/env python3
"""Generate the Make.com scenario blueprint for Lunch Money category setup."""

import json

CONNECTION_ID = 8882969
APP = "app#lunchmoney-65tvqd"

# (group_name, group-level flags) — module IDs 1..9
GROUPS = [
    ("Income", {"is_income": True}),
    ("People", {}),
    ("Software & Tools", {}),
    ("Event & Program Delivery", {}),
    ("Travel & Meals", {}),
    ("Professional Services", {}),
    ("Payment Processing", {}),
    ("Other Operating", {}),
    ("Transfers", {"exclude_from_totals": True, "exclude_from_budget": True}),
]

# (category_name, parent_group_name, category-level flags) — module IDs 10..41
CATEGORIES = [
    ("Program Revenue", "Income", {"is_income": True}),
    ("Event Revenue", "Income", {"is_income": True}),
    ("Coaching Revenue", "Income", {"is_income": True}),
    ("Membership / Recurring Revenue", "Income", {"is_income": True}),
    ("Other Income", "Income", {"is_income": True}),

    ("Founder Pay – Peter", "People", {}),
    ("Founder Pay – Violet", "People", {}),
    ("Contractor Pay", "People", {}),
    ("Facilitator Splits", "People", {}),
    ("Honoraria & Guest Pay", "People", {}),

    ("Software & Subscriptions", "Software & Tools", {}),

    ("Venue Rentals", "Event & Program Delivery", {}),
    ("Event Supplies & Materials", "Event & Program Delivery", {}),

    ("Air & Long-Distance Transport", "Travel & Meals", {}),
    ("Ground Transport", "Travel & Meals", {}),
    ("Lodging", "Travel & Meals", {}),
    ("Mileage", "Travel & Meals", {}),
    ("Business Meals", "Travel & Meals", {}),

    ("Legal", "Professional Services", {}),
    ("Accounting", "Professional Services", {}),
    ("Insurance", "Professional Services", {}),
    ("Banking & Wire Fees", "Professional Services", {}),

    ("Stripe Fees", "Payment Processing", {}),
    ("PayPal Fees", "Payment Processing", {}),
    ("Ticket Tailor Fees", "Payment Processing", {}),

    ("Equipment & Hardware", "Other Operating", {}),
    ("One-Time Software", "Other Operating", {}),
    ("Office / Workspace", "Other Operating", {}),
    ("Miscellaneous Business", "Other Operating", {}),

    ("Inter-Account Transfers", "Transfers", {"exclude_from_totals": True, "exclude_from_budget": True}),
    ("Owner Draws", "Transfers", {"exclude_from_totals": True, "exclude_from_budget": True}),
    ("Personal", "Transfers", {"exclude_from_totals": True, "exclude_from_budget": True}),
]


def main():
    flow = []
    group_module_id = {}

    # Groups: module IDs 1..9
    for i, (name, flags) in enumerate(GROUPS, start=1):
        mapper = {"name": name, **flags}
        flow.append({
            "id": i,
            "module": f"{APP}:CreateaCategoryGroup",
            "version": 1,
            "parameters": {"__IMTCONN__": CONNECTION_ID},
            "mapper": mapper,
            "metadata": {
                "designer": {"x": (i - 1) * 300, "y": 0},
                "restore": {"parameters": {"__IMTCONN__": {"label": "My Lunch Money connection"}}},
                "parameters": [{"name": "__IMTCONN__", "type": "account", "label": "Connection", "required": True}],
                "expect": [
                    {"name": "name", "type": "text", "label": "Name", "required": True},
                    {"name": "description", "type": "text", "label": "Description"},
                    {"name": "is_income", "type": "boolean", "label": "Is Income"},
                    {"name": "exclude_from_budget", "type": "boolean", "label": "Exclude From Budget"},
                    {"name": "exclude_from_totals", "type": "boolean", "label": "Exclude From Totals"},
                    {"name": "category_ids", "type": "array", "label": "Category IDs"},
                    {"name": "new_categories", "type": "array", "label": "New Categories"},
                ],
            },
        })
        group_module_id[name] = i

    # Categories: module IDs 10..41 (10 onwards)
    for j, (name, parent, flags) in enumerate(CATEGORIES, start=len(GROUPS) + 1):
        parent_id = group_module_id[parent]
        mapper = {"name": name, "group_id": f"{{{{{parent_id}.id}}}}", **flags}
        # designer x position: stack categories below their parent group
        parent_x = (parent_id - 1) * 300
        # count how many categories under this parent come before this one
        siblings_before = sum(1 for c in CATEGORIES[:j - len(GROUPS) - 1] if c[1] == parent)
        flow.append({
            "id": j,
            "module": f"{APP}:createaCategory",
            "version": 1,
            "parameters": {"__IMTCONN__": CONNECTION_ID},
            "mapper": mapper,
            "metadata": {
                "designer": {"x": parent_x, "y": (siblings_before + 1) * 200},
                "restore": {"parameters": {"__IMTCONN__": {"label": "My Lunch Money connection"}}},
                "parameters": [{"name": "__IMTCONN__", "type": "account", "label": "Connection", "required": True}],
                "expect": [
                    {"name": "name", "type": "text", "label": "Name", "required": True},
                    {"name": "description", "type": "text", "label": "Description"},
                    {"name": "is_income", "type": "boolean", "label": "Is Income"},
                    {"name": "exclude_from_budget", "type": "boolean", "label": "Exclude From Budget"},
                    {"name": "exclude_from_totals", "type": "boolean", "label": "Exclude From Totals"},
                    {"name": "archived", "type": "boolean", "label": "Archived"},
                    {"name": "group_id", "type": "uinteger", "label": "Group ID"},
                ],
            },
        })

    blueprint = {
        "flow": flow,
        "name": "Integration Lunch Money",
        "metadata": {
            "instant": False,
            "version": 1,
            "designer": {"orphans": []},
            "scenario": {
                "dlq": False,
                "slots": None,
                "dataloss": False,
                "maxErrors": 3,
                "autoCommit": True,
                "roundtrips": 1,
                "sequential": True,  # IMPORTANT: must run in order, no parallel
                "confidential": False,
                "freshVariables": False,
                "autoCommitTriggerLast": True,
            },
        },
        "scheduling": {"type": "indefinitely", "interval": 900},
        "interface": {"input": [], "output": []},
    }

    with open("/tmp/blueprint.json", "w") as f:
        json.dump(blueprint, f, indent=2)
    print(f"Wrote /tmp/blueprint.json with {len(flow)} modules ({len(GROUPS)} groups + {len(CATEGORIES)} categories)")


if __name__ == "__main__":
    main()
