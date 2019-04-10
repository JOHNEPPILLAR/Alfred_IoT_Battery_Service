/**
 * Import external libraries
 */
const apn = require('apn');

/**
 * Import helper libraries
 */
const serviceHelper = require('../lib/helper.js');

async function sendPushNotification(apnProvider, user, message) {
  const notification = new apn.Notification();
  notification.topic = 'JP.Alfred-IOS';
  notification.expiry = Math.floor(Date.now() / 1000) + 600; // Expires 10 minutes from now.
  notification.alert = message;
  const result = await apnProvider.send(notification, user.device_token);
  if (result.sent.length === 1) {
    serviceHelper.log('info', `Battery push notification sent to: ${user.device_token}`);
  } else {
    serviceHelper.log('error', `Battery push notification failed to send: ${result.failed[0].response.reason}, for device: ${user.device_token}`);
  }
  return true;
}

async function processData(message) {
  let results;
  let dbClient;

  // Get the list of devices to push notifiactions to
  const SQL = 'SELECT last(device_token, time) as device_token, app_user FROM ios_devices WHERE app_user is not null GROUP BY app_user';
  try {
    serviceHelper.log('trace', 'Connect to data store connection pool');
    dbClient = await global.deviceDataClient.connect(); // Connect to data store
    serviceHelper.log('trace', 'Getting IOS devices');
    results = await dbClient.query(SQL);
    serviceHelper.log('trace', 'Release the data store connection back to the pool');
    await dbClient.release(); // Return data store connection back to pool

    if (results.rowCount === 0) {
      serviceHelper.log('warn', 'No devices registered to send push notifications to');
      return false;
    } // Exit function as no data to process

    // Connect to apples push notification service
    serviceHelper.log('trace', 'Connect to Apple push notification service');
    const apnProvider = new apn.Provider({
      cert: './certs/push.pem',
      key: './certs/push_key.pem',
      production: true,
    });

    // Send notifications
    await Promise.all(results.rows.map(user => sendPushNotification(apnProvider, user, message)));
    serviceHelper.log('trace', 'Close down connection to push notification service');
    await apnProvider.shutdown(); // Close the connection with apn
  } catch (err) {
    serviceHelper.log('error', err.message);
    return false;
  }
  return true;
}

/**
 * Get battery data for last hour
 */
exports.getData = async () => {
  try {
    const minBatteryLevel = 10;

    const SQL = 'SELECT battery, location, device FROM vw_battery_data';
    serviceHelper.log('trace', 'Connect to data store connection pool');
    const dbClient = await global.deviceDataClient.connect(); // Connect to data store
    serviceHelper.log('trace', 'Get battery data from data store');
    const results = await dbClient.query(SQL);
    serviceHelper.log('trace', 'Release the data store connection back to the pool');
    await dbClient.release(); // Return data store connection back to pool

    // Get link-tap data
    const url = 'https://www.link-tap.com/api/getAllDevices';
    const body = {
      username: process.env.LinkTapUser,
      apiKey: process.env.LinkTapKey,
    };
    const linkTapData = await serviceHelper.callAPIServicePut(url, body);

    if (linkTapData instanceof Error) {
      serviceHelper.log('error', 'LinkTap: Unable to get LinkTap data');
    } else {
      let batteryLevel = linkTapData.devices[0].taplinker[0].batteryStatus;
      batteryLevel = Number(batteryLevel.slice(0, -1));
      const linkTapBatteryData = { battery: batteryLevel, location: 'Garden', device: 'LinkTap' };
      results.rows.push(linkTapBatteryData);
    }

    if (results.rowCount === 0) {
      serviceHelper.log('warn', 'No battery data in the last hour');
      processData('No 🔋data in the last hour');
      return;
    }
    // Filter out ok battery readings
    serviceHelper.log('trace', 'Filtering out ok battery readings');
    const lowBattery = results.rows.filter(rec => rec.battery < minBatteryLevel);

    let message = '🔋 levels low:\r\n';
    lowBattery.forEach((device) => {
      message = `${message}${device.device} - ${device.location} (${device.battery}%)\r\n`;
    });
    if (lowBattery.length > 0) {
      processData(message);
    } else {
      serviceHelper.log('trace', 'Battery levels ok');
    }
  } catch (err) {
    serviceHelper.log('error', err.message);
  }
};
