import json, re

data = json.load(open('/root/.claude/projects/-home-user-claude-code/cb831eb0-01de-4003-84c9-ed4218679eb8/tool-results/mcp-04f4a171-5ccc-4676-be40-18977b75779f-read_file_content-1777915279233.txt'))
content = data['fileContent']
lines = content.split('\n')

# The master contact list is lines 0-427 (header + contacts + Somatic Playground section)
# Lines 428+ are summary tables and other sheet tabs - skip them
CONTACT_LINES = lines[0:428]

def parse_row(line):
    if not line.startswith('|'):
        return None
    parts = line.split('|')
    cells = [p.strip() for p in parts[1:-1]]
    return cells

# Event name keywords → HIST tag mapping
EVENT_TAG_MAP = [
    ('Accelerated Evolution', 'HIST: Accelerated Evolution'),
    ('Archetypal Interplay', 'HIST: Archetypal Interplay'),
    ('Innerplay', 'HIST: Innerplay Meditation'),
    ('Online Intro Event', 'HIST: Online Intro Event'),
    ('Intro Event', 'HIST: Intro Evening'),
    ('Relational INTERPLAY Intro', 'HIST: Intro Evening'),
    ('Relational INTERPLAY: An Afternoon', 'HIST: Intro Afternoon'),
    ('Relational INTERPLAY: How to Play with Power', 'HIST: How to Play with Power'),
    ('Relational INTERPLAY: Couples Immersion', 'HIST: Couples Immersion'),
    ('Relational INTERPLAY Practice Night', 'HIST: Practice Night'),
    ('Mocktails & INTERPLAY', 'HIST: Mocktails & INTERPLAY Hot Seat'),
    ('INTERPLAY & CHILL', 'HIST: INTERPLAY & CHILL Co-Regulating'),
    ('Relationship Immersion', 'HIST: Relationship Immersion'),
]

def get_hist_tags(event_str):
    tags = set()
    if not event_str:
        return tags
    ev = event_str.strip()
    for keyword, tag in EVENT_TAG_MAP:
        if keyword.lower() in ev.lower():
            tags.add(tag)
    return tags

# Explicit email-level overrides
EMAIL_NAME_OVERRIDES = {
    'ahranleecoaching@gmail.com': 'Ahran Lee',
    'jaberko@hotmail.com': 'Jascha Hoffman',
}

SKIP_EMAILS = {
    'no@no.com',
    'peki1981@aol.com',  # duplicate Sena - keep only sena.koleva@gmail.com
}

GARBLED_NAME_PATTERNS = [
    (re.compile(r'Kendr[^a-z\s]', re.IGNORECASE), 'Kendra'),
    (re.compile(r'Faruk\s+Ate[^s\s]', re.IGNORECASE), 'Faruk Ateş'),
    (re.compile(r'Ren[^e\s].*Bonhomme', re.IGNORECASE), 'Rena Bonhomme'),
    (re.compile(r'J[^a\s].*schwa.*Hoffman', re.IGNORECASE), 'Jascha Hoffman'),
]

def fix_name(raw_name, email):
    el = email.lower()
    if el in EMAIL_NAME_OVERRIDES:
        return EMAIL_NAME_OVERRIDES[el]
    name = raw_name.strip()
    for pattern, replacement in GARBLED_NAME_PATTERNS:
        if pattern.search(name):
            return replacement
    return name

def should_skip(email):
    el = email.lower().strip()
    if not el:
        return True, 'empty email'
    if 'privaterelay.appleid.com' in el:
        return True, 'private relay'
    if 'passmail.net' in el:
        return True, 'passmail relay'
    if el in SKIP_EMAILS:
        return True, f'explicit skip: {el}'
    return False, None

contacts = {}  # email.lower() -> dict
skipped = []
somatic_skipped = []

for line in CONTACT_LINES:
    cells = parse_row(line)
    if not cells or len(cells) < 3:
        continue
    # Skip header/separator rows
    if cells[0] in ('Name', ':-:', ':--:') or cells[1] in ('Email', ':-:', ':--:'):
        continue
    # Skip blank rows
    if not cells[0].strip() and not cells[1].strip():
        continue

    name_raw = cells[0].strip()
    email_raw = cells[1].strip()
    subscribed = cells[2].strip() if len(cells) > 2 else ''
    event_str = cells[3].strip() if len(cells) > 3 else ''

    if not name_raw or not email_raw:
        continue

    email = email_raw.lower()

    # Somatic Playground rule: skip if ONLY somatic and not subscribed
    has_somatic = 'Somatic Playground' in event_str
    events_listed = [e.strip() for e in re.split(r',\s*', event_str) if e.strip()]
    non_somatic_events = [e for e in events_listed if 'Somatic Playground' not in e]

    if has_somatic and subscribed.lower() != 'yes' and not non_somatic_events:
        somatic_skipped.append({'name': name_raw, 'email': email})
        continue

    # Email skip rules
    skip, reason = should_skip(email)
    if skip:
        skipped.append({'name': name_raw, 'email': email, 'reason': reason})
        continue

    # Fix name
    fixed_name = fix_name(name_raw, email)
    name_parts = fixed_name.split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    # Build tags
    tags = {'HIST: RI Community'}
    tags.update(get_hist_tags(event_str))
    if 'Community membership' in event_str or 'Community Member' in event_str:
        tags.add('Community Member')

    # Merge duplicates (same email, different row)
    if email in contacts:
        contacts[email]['tags'].update(tags)
        # Prefer longer/more complete name
        current_full = contacts[email]['first_name'] + ' ' + contacts[email]['last_name']
        if len(fixed_name) > len(current_full.strip()):
            contacts[email]['first_name'] = first_name
            contacts[email]['last_name'] = last_name
    else:
        contacts[email] = {
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'tags': tags,
        }

contact_list = []
for email, c in contacts.items():
    contact_list.append({
        'email': c['email'],
        'first_name': c['first_name'],
        'last_name': c['last_name'],
        'tags': sorted(list(c['tags'])),
    })

print(f"Total unique importable contacts: {len(contact_list)}")
print(f"Skipped (rules): {len(skipped)}")
print(f"Somatic Playground skipped: {len(somatic_skipped)}")
print()
print("=== SKIPPED ===")
for s in skipped:
    print(f"  {s['name']} <{s['email']}> — {s['reason']}")
print()
print("=== FIRST 10 CONTACTS ===")
for c in contact_list[:10]:
    print(f"  {c['first_name']} {c['last_name']} <{c['email']}> → {c['tags']}")

# Save to file
with open('/home/user/claude-code/master_contacts.json', 'w') as f:
    json.dump(contact_list, f, indent=2)
print(f"\nSaved to /home/user/claude-code/master_contacts.json")
