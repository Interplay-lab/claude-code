// Automation: Monthly Bookkeeper Email
//
// Purpose: On the 5th of each month, collect every Approved payout row
// (Pay Periods, Profit Share Payouts, Facilitator Payouts past Eligible Date)
// and send a single email to finance.interplay@gmail.com with the full
// breakdown. Marks each row as Sent to Bookkeeper.
//
// Trigger: "At a scheduled time" — Monthly, day 5, 9:00 AM Mountain Time.
//
// After this script step, add a "Send email" action that uses
// `subject` and `bodyHtml` from this script's output.
//
// Special rule: Johanna's own Pay Period row is excluded unless the
// "Approved by Violet (for Johanna)" checkbox is checked. Johanna is
// the bookkeeper and cannot self-approve her pay.

const today = new Date();
const todayISO = toISO(today);
const monthName = today.toLocaleString('en-US', { month: 'long', year: 'numeric' });

const peopleTable = base.getTable('People');
const payPeriodsTable = base.getTable('Pay Periods');
const profitShareTable = base.getTable('Profit Share Payouts');
const facPayoutsTable = base.getTable('Facilitator Payouts');

// Pre-load people for cheap lookups
const peopleQuery = await peopleTable.selectRecordsAsync({
  fields: ['Name', 'Payout Method'],
});
const peopleById = new Map();
for (const p of peopleQuery.records) {
  peopleById.set(p.id, {
    name: p.getCellValue('Name'),
    method: p.getCellValue('Payout Method')?.name || '',
  });
}

const rows = [];

// 1. Pay Periods — Status = Approved
const ppQuery = await payPeriodsTable.selectRecordsAsync({
  fields: ['Person', 'Total Hours', 'Hourly Rate', 'Total $', 'Status', 'Approved by Violet (for Johanna)', 'Memo'],
});
for (const r of ppQuery.records) {
  if (r.getCellValue('Status')?.name !== 'Approved') continue;
  const personLink = r.getCellValue('Person');
  if (!personLink?.length) continue;
  const person = peopleById.get(personLink[0].id);
  if (!person) continue;
  // Self-approval guard for Johanna
  if (person.name?.toLowerCase().includes('johanna')) {
    if (!r.getCellValue('Approved by Violet (for Johanna)')) continue;
  }
  rows.push({
    id: r.id,
    table: 'Pay Periods',
    name: person.name,
    amount: r.getCellValue('Total $') || 0,
    method: person.method,
    memo: r.getCellValue('Memo') || '',
    source: 'Hourly',
  });
}

// 2. Profit Share — Status = Approved
const psQuery = await profitShareTable.selectRecordsAsync({
  fields: ['Person', 'Payout Amount', 'Status', 'Memo'],
});
for (const r of psQuery.records) {
  if (r.getCellValue('Status')?.name !== 'Approved') continue;
  const personLink = r.getCellValue('Person');
  if (!personLink?.length) continue;
  const person = peopleById.get(personLink[0].id);
  if (!person) continue;
  rows.push({
    id: r.id,
    table: 'Profit Share Payouts',
    name: person.name,
    amount: r.getCellValue('Payout Amount') || 0,
    method: person.method,
    memo: r.getCellValue('Memo') || '',
    source: 'Profit Share',
  });
}

// 3. Facilitator Payouts — Status = Approved AND Eligible Date <= today
const fpQuery = await facPayoutsTable.selectRecordsAsync({
  fields: ['Person', 'Payout Amount', 'Status', 'Eligible Date', 'Memo'],
});
for (const r of fpQuery.records) {
  if (r.getCellValue('Status')?.name !== 'Approved') continue;
  const eligible = r.getCellValue('Eligible Date');
  if (!eligible || eligible > todayISO) continue;
  const personLink = r.getCellValue('Person');
  if (!personLink?.length) continue;
  const person = peopleById.get(personLink[0].id);
  if (!person) continue;
  rows.push({
    id: r.id,
    table: 'Facilitator Payouts',
    name: person.name,
    amount: r.getCellValue('Payout Amount') || 0,
    method: person.method,
    memo: r.getCellValue('Memo') || '',
    source: 'Event Payout',
  });
}

const totalAmt = rows.reduce((s, r) => s + r.amount, 0);

// Build email
const subject = rows.length === 0
  ? `${monthName} payouts — nothing to process`
  : `${monthName} payouts — ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}, $${totalAmt.toFixed(2)} total`;

let bodyHtml = `<p>Hi Johanna,</p>`;
if (rows.length === 0) {
  bodyHtml += `<p>No approved payouts this cycle. Nothing to process for ${monthName}.</p>`;
} else {
  bodyHtml += `<p>Approved payouts for ${monthName}. <strong>Total: $${totalAmt.toFixed(2)}</strong> across ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}.</p>`;
  bodyHtml += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">`;
  bodyHtml += `<tr style="background:#f0f0f0;"><th align="left">Person</th><th align="right">Amount</th><th align="left">Method</th><th align="left">Source</th><th align="left">Memo</th></tr>`;
  rows.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rows) {
    bodyHtml += `<tr><td>${escapeHtml(r.name)}</td><td align="right">$${r.amount.toFixed(2)}</td><td>${escapeHtml(r.method)}</td><td>${r.source}</td><td>${escapeHtml(r.memo)}</td></tr>`;
  }
  bodyHtml += `</table>`;
  bodyHtml += `<p>Once each payment is issued, please mark the corresponding row "Paid" in Airtable.</p>`;
}
bodyHtml += `<p style="color:#888;font-size:11px;">— Automated by Relational Interplay's payout system</p>`;

// Mark all rows as Sent to Bookkeeper
const updatesByTable = new Map();
for (const r of rows) {
  if (!updatesByTable.has(r.table)) updatesByTable.set(r.table, []);
  updatesByTable.get(r.table).push({
    id: r.id,
    fields: { 'Status': { name: 'Sent to Bookkeeper' }, 'Date Sent': todayISO },
  });
}
for (const [tableName, updates] of updatesByTable) {
  const t = base.getTable(tableName);
  while (updates.length > 0) {
    const batch = updates.splice(0, 50);
    await t.updateRecordsAsync(batch);
  }
}

output.set('subject', subject);
output.set('bodyHtml', bodyHtml);
output.set('rowCount', rows.length);
output.set('totalAmt', totalAmt.toFixed(2));
output.set('hasRows', rows.length > 0);

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
