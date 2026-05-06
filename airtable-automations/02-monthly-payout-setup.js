// Automation: Monthly Payout Setup
//
// Purpose: On the 1st of each month, generate all the payout rows for the
// PRIOR month so Violet can review, fill in hours, and approve before the
// bookkeeper email fires on the 5th.
//
//   - Pay Periods row for each Active monthly contractor
//   - Salary Log row for each Active salaried person (visibility only)
//   - Profit Share Payouts row for each person flagged Eligible for Profit Share
//       (currently only Violet, 15% of summed Adjusted Gross of last month's events)
//   - Promotes Facilitator Payouts past their Eligible Date from Draft → Ready for Review
//
// Trigger: "At a scheduled time" — Monthly, day 1, 9:00 AM Mountain Time.
//
// No input variables needed.
//
// After this script runs, the next automation step in the same automation
// should send the approval email to Violet using the `summary` output below.

const today = new Date();

// Prior month range
const periodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
const isoStart = toISO(periodStart);
const isoEnd = toISO(periodEnd);
const monthLabel = `${periodStart.getFullYear()}-${pad(periodStart.getMonth() + 1)}`;
const monthName = periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });

const peopleTable = base.getTable('People');
const eventsTable = base.getTable('Events');
const payPeriodsTable = base.getTable('Pay Periods');
const profitShareTable = base.getTable('Profit Share Payouts');
const salaryLogTable = base.getTable('Salary Log');
const facPayoutsTable = base.getTable('Facilitator Payouts');

// Pre-fetch events for the month (for profit share rollup)
const eventsQuery = await eventsTable.selectRecordsAsync({
  fields: ['Date', 'Adjusted Gross'],
});
let monthAdjustedGross = 0;
for (const evt of eventsQuery.records) {
  const d = evt.getCellValue('Date');
  if (d && d >= isoStart && d <= isoEnd) {
    monthAdjustedGross += evt.getCellValue('Adjusted Gross') || 0;
  }
}

const peopleQuery = await peopleTable.selectRecordsAsync({
  fields: [
    'Name',
    'Status',
    'Hourly Rate',
    'Interplay Bucks Rate',
    'Monthly Salary',
    'Pay Cadence',
    'Eligible for Profit Share',
    'Profit Share %',
  ],
});

const summary = { payPeriods: 0, salaries: 0, profitShares: 0, promoted: 0 };

for (const person of peopleQuery.records) {
  if (person.getCellValue('Status')?.name !== 'Active') continue;

  const name = person.getCellValue('Name');
  const cadence = person.getCellValue('Pay Cadence')?.name;

  if (cadence === 'Monthly') {
    const rate = person.getCellValue('Hourly Rate') || 0;
    const ibRate = person.getCellValue('Interplay Bucks Rate') || 0;
    await payPeriodsTable.createRecordAsync({
      'Period Label': `${name} — ${monthLabel}`,
      'Person': [{ id: person.id }],
      'Period Start': isoStart,
      'Period End': isoEnd,
      'Hourly Rate': rate,
      'IB Rate': ibRate,
      'Status': { name: 'Draft' },
      'Memo': `${monthName} — pending hours @ $${rate}/hr`,
    });
    summary.payPeriods++;
  }

  if (cadence === 'Salary (Logged Only)') {
    const salary = person.getCellValue('Monthly Salary') || 0;
    await salaryLogTable.createRecordAsync({
      'Period Label': `${name} — ${monthLabel} salary`,
      'Person': [{ id: person.id }],
      'Period Start': isoStart,
      'Period End': isoEnd,
      'Amount': salary,
      'Paid via': { name: 'Capital One Auto' },
    });
    summary.salaries++;
  }

  if (person.getCellValue('Eligible for Profit Share')) {
    const pct = person.getCellValue('Profit Share %') || 0;
    const amount = monthAdjustedGross * pct;
    await profitShareTable.createRecordAsync({
      'Period Label': `${name} — ${monthLabel}`,
      'Person': [{ id: person.id }],
      'Period Start': isoStart,
      'Period End': isoEnd,
      'Adjusted Gross Total': monthAdjustedGross,
      'Profit Share %': pct,
      'Status': { name: 'Draft' },
      'Memo': `${monthName} profit share — ${(pct * 100).toFixed(0)}% of $${monthAdjustedGross.toFixed(2)}`,
    });
    summary.profitShares++;
  }
}

// Promote Facilitator Payouts past Eligible Date from Draft → Ready for Review
const todayISO = toISO(today);
const fpQuery = await facPayoutsTable.selectRecordsAsync({
  fields: ['Status', 'Eligible Date'],
});
const promotions = [];
for (const fp of fpQuery.records) {
  const status = fp.getCellValue('Status')?.name;
  const eligible = fp.getCellValue('Eligible Date');
  if (status === 'Draft' && eligible && eligible <= todayISO) {
    promotions.push({ id: fp.id, fields: { 'Status': { name: 'Ready for Review' } } });
  }
}
// Update in batches of 50
while (promotions.length > 0) {
  const batch = promotions.splice(0, 50);
  await facPayoutsTable.updateRecordsAsync(batch);
  summary.promoted += batch.length;
}

output.set('summary', summary);
output.set('monthLabel', monthLabel);
output.set('monthName', monthName);
output.set('adjustedGross', monthAdjustedGross);

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
