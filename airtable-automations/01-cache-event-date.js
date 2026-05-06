// Automation: Cache Event Date on Facilitator Payouts
//
// Purpose: When a Facilitator Payouts row gets an Event link, copy that
// event's Date into the row's "Event Date (cached)" field. This drives the
// Eligible Date formula (Event Date + 7 days) without needing a lookup field.
//
// Trigger: "When record matches conditions" on the Facilitator Payouts table
//   - Conditions:
//       Event              is not empty
//       Event Date (cached) is empty
//   - Pass the triggering record into the script as input variable: recordId
//
// Input variables to define in the automation UI (Step: Run script):
//   recordId  =  Airtable record ID  (from the trigger's "Record ID")

const { recordId } = input.config();

const facPayoutsTable = base.getTable('Facilitator Payouts');
const eventsTable = base.getTable('Events');

const record = await facPayoutsTable.selectRecordAsync(recordId, {
  fields: ['Event', 'Event Date (cached)'],
});
if (!record) return;

const eventLinks = record.getCellValue('Event');
if (!eventLinks || eventLinks.length === 0) return;

const event = await eventsTable.selectRecordAsync(eventLinks[0].id, {
  fields: ['Date'],
});
if (!event) return;

const eventDate = event.getCellValue('Date');
if (!eventDate) return;

await facPayoutsTable.updateRecordAsync(recordId, {
  'Event Date (cached)': eventDate,
});

output.set('cachedDate', eventDate);
