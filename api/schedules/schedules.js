/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;

/**
 * Import helper libraries
 */
const serviceHelper = require('../../lib/helper.js');
const scheduleController = require('../../schedules/controller.js');

const skill = new Skills();

/**
 * @api {get} /schedule/reset Reset the schedules
 * @apiName reset
 * @apiGroup Schedule
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     data: "Reset scheduler"
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
function resetSchedule(req, res, next) {
  serviceHelper.log('trace', 'resetSchedule', 'Reset Schedule API called');
  scheduleController.setSchedule(true);
  serviceHelper.sendResponse(res, true, 'Reset scheduler');
  next();
}
skill.get('/reset', resetSchedule);

/**
 * @api {get} /schedule/list List all of the schedules
 * @apiName list
 * @apiGroup Schedule
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *      "data": {
 *       "command": "SELECT",
 *       "rowCount": 7,
 *       "oid": null,
 *       "rows": [ .. ]",
 *       ...
 *      }
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function listSchedules(req, res, next) {
  serviceHelper.log('trace', 'list schedules', 'List Schedules API called');

  let dbClient;
  let results;

  try {
    // Get data from data store
    const SQL = 'SELECT * FROM vw_timers_with_detail';
    serviceHelper.log('trace', 'listSchedules', 'Connect to data store connection pool');
    dbClient = await global.schedulesDataClient.connect(); // Connect to data store
    serviceHelper.log('trace', 'listSchedules', 'Get schedules');
    results = await dbClient.query(SQL);
    serviceHelper.log('trace', 'listSchedules', 'Release the data store connection back to the pool');
    await dbClient.release(); // Return data store connection back to pool

    // Send data back to caler
    serviceHelper.sendResponse(res, true, results);
    next();
  } catch (err) {
    serviceHelper.log('error', 'listSchedules', err.message);
    serviceHelper.sendResponse(res, false, err);
    next();
  }
  return true;
}
skill.get('/list', listSchedules);

/**
 * @api {put} /schedule/save save schedule
 * @apiName save
 * @apiGroup Schedule
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *      "data": {
 *       "saved": "true"
 *      }
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function saveSchedule(req, res, next) {
  serviceHelper.log('trace', 'saveSchedule', 'Save Schedule API called');

  let dbClient;
  let timerResults;
  const { 
    id, name, hour, minute, ai_override, active, type, light_timers_id, light_group_number, brightness, scene, color_loop 
  } = req.body;

  try {
    // Update data in data store
    let SQL = 'UPDATE timers SET name = $2, hour = $3, minute = $4, ai_override = $5, active = $6 WHERE id = $1';
    let SQLValues = [
      id,
      name,
      hour,
      minute,
      ai_override,
      active,
    ];

    serviceHelper.log('trace', 'saveSchedule', 'Connect to data store connection pool');
    dbClient = await global.schedulesDataClient.connect(); // Connect to data store
    serviceHelper.log('trace', 'saveSchedule', 'Save schedule');
    timerResults = await dbClient.query(SQL, SQLValues);

    // If timer has light data then save extra details
    if (type === 4 || type === 5 || type === 6) {
      serviceHelper.log('trace', 'saveSchedule', 'Save light schedule data');
      SQL = 'UPDATE light_timers SET light_group_number = $2, brightness = $3, scene = $4, color_loop = $5 WHERE id = $1';
      SQLValues = [
        light_timers_id,
        light_group_number,
        brightness,
        scene,
        color_loop,
      ];
      await dbClient.query(SQL, SQLValues);
    }

    serviceHelper.log('trace', 'saveSchedule', 'Release the data store connection back to the pool');
    await dbClient.release(); // Return data store connection back to pool

    // Send data back to caler
    if (timerResults.rowCount === 1) {
      serviceHelper.log('info', 'saveSchedule', `Saved schedule data: ${JSON.stringify(req.body)}`);
      serviceHelper.sendResponse(res, true, 'saved');
      serviceHelper.log('trace', 'saveSchedule', 'Resettings all schedules');
      scheduleController.setSchedule(true);
    } else {
      serviceHelper.log('error', 'saveSchedule', 'Failed to save data');
      serviceHelper.sendResponse(res, false, 'failed to save');
    }
    next();
  } catch (err) {
    serviceHelper.log('error', 'saveSchedule', err.message);
    serviceHelper.sendResponse(res, false, 'failed to save');
    next();
  }
  return true;
}
skill.put('/save', saveSchedule);

module.exports = skill;
