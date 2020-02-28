/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const serviceHelper = require('alfred-helper');
const dateformat = require('dateformat');

/**
 * Import helper libraries
 */
const batteryCheck = require('./battery.js');

async function collectData() {
  const date = new Date();
  date.setHours(18);
  date.setMinutes(0);
  const schedule = scheduler.scheduleJob(date, () => batteryCheck.getData()); // Set the schedule
  global.schedules.push(schedule);
  serviceHelper.log(
    'info',
    `Battery check scheduled for ${dateformat(date, 'dd-mm-yyyy @ HH:MM')}`,
  );
}

// Set up the schedules
async function setSchedule() {
  // Cancel any existing schedules
  serviceHelper.log(
    'trace',
    'Removing any existing schedules',
  );
  await global.schedules.map((value) => value.cancel());

  // Set schedules each day to keep in sync with sunrise & sunset changes
  const rule = new scheduler.RecurrenceRule();
  rule.hour = 3;
  rule.minute = 5;
  const schedule = scheduler.scheduleJob(rule, () => collectData()); // Set the schedule
  global.schedules.push(schedule);
  await collectData();
}

exports.setSchedule = setSchedule;
