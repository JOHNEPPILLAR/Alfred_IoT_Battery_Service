/**
 * Import external libraries
 */
const schedule = require('node-schedule');
const serviceHelper = require('alfred-helper');

/**
 * Import helper libraries
 */
const batteryCheck = require('./battery.js');

exports.collectData = async function FnCollectData() {
  let rule = new schedule.RecurrenceRule();

  // Set first schedule
  rule.hour = 7;
  rule.minute = 0;
  schedule.scheduleJob(rule, () => {
    batteryCheck.getData();
  }); // Set the timer
  serviceHelper.log(
    'info',
    `Battery check scheduled for ${rule.hour}:${serviceHelper.zeroFill(
      rule.minute,
      2,
    )}`,
  );

  // Set second schedule
  rule = new schedule.RecurrenceRule();
  rule.hour = 18;
  rule.minute = 0;
  schedule.scheduleJob(rule, () => {
    batteryCheck.getData();
  }); // Set the timer
  serviceHelper.log(
    'info',
    `Battery check scheduled for ${rule.hour}:${serviceHelper.zeroFill(
      rule.minute,
      2,
    )}`,
  );
};
