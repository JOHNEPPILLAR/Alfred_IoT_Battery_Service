/**
 * Import external libraries
 */
const schedule = require('node-schedule');

/**
 * Import helper libraries
 */
const serviceHelper = require('../lib/helper.js');
const batteryCheck = require('./battery.js');

exports.collectData = async function FnCollectData() {
  const rule = new schedule.RecurrenceRule();
  rule.hour = 18;
  rule.minute = 0;
  schedule.scheduleJob(rule, (() => { batteryCheck.getData(); })); // Set the timer
  serviceHelper.log('info', 'collectData', `Battery check scheduled for ${rule.hour}:${serviceHelper.zeroFill(rule.minute, 2)}`);
};
