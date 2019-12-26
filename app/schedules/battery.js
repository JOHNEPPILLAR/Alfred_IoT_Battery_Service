/**
 * Import external libraries
 */
const apn = require('apn');
const serviceHelper = require('alfred-helper');

async function sendPushNotification(apnProvider, user, message) {
  try {
    const notification = new apn.Notification();
    notification.topic = 'JP.Alfred-IOS';
    notification.expiry = Math.floor(Date.now() / 1000) + 600; // Expires 10 minutes from now.
    notification.alert = message;
    const result = await apnProvider.send(notification, user.device_token);
    if (result.sent.length === 1) {
      serviceHelper.log(
        'info',
        `Battery push notification sent to: ${user.device_token}`,
      );
    } else {
      serviceHelper.log(
        'error',
        `Battery push notification failed to send: ${result.failed[0].response.reason}, for device: ${user.device_token}`,
      );
    }
    return true;
  } catch (err) {
    serviceHelper.log('error', err.message);
    return false;
  }
}

async function processData(message) {
  let results;

  // Get the list of devices to push notifiactions to
  const SQL = 'SELECT last(device_token, time) as device_token FROM ios_devices';
  try {
    serviceHelper.log('trace', 'Connect to data store connection pool');
    const dbConnection = await serviceHelper.connectToDB('devices');
    const dbClient = await dbConnection.connect(); // Connect to data store
    serviceHelper.log('trace', 'Getting IOS devices');
    results = await dbClient.query(SQL);
    serviceHelper.log(
      'trace',
      'Release the data store connection back to the pool',
    );
    await dbClient.release(); // Return data store connection back to pool
    await dbClient.end(); // Close data store connection

    if (results.rowCount === 0) {
      serviceHelper.log(
        'warn',
        'No devices registered to send push notifications to',
      );
      return false;
    } // Exit function as no data to process

    // Connect to apples push notification service
    serviceHelper.log('trace', 'Connect to Apple push notification service');
    const IOSNotificationKeyID = await serviceHelper.vaultSecret(process.env.ENVIRONMENT, 'IOSNotificationKeyID');
    const IOSNotificationTeamID = await serviceHelper.vaultSecret(process.env.ENVIRONMENT, 'IOSNotificationTeamID');
    const IOSPushKey = await serviceHelper.vaultSecret(process.env.ENVIRONMENT, 'IOSPushKey');
    if (IOSNotificationKeyID instanceof Error
      || IOSNotificationTeamID instanceof Error
      || IOSPushKey instanceof Error) {
      serviceHelper.log('error', 'Not able to get secret (CERTS) from vault');
      return false;
    }
    const apnProvider = new apn.Provider({
      token: {
        key: IOSPushKey,
        keyId: IOSNotificationKeyID,
        teamId: IOSNotificationTeamID,
      },
      production: true,
    });

    // Send notifications
    await Promise.all(
      results.rows.map((user) => sendPushNotification(apnProvider, user, message)),
    );
    serviceHelper.log(
      'trace',
      'Close down connection to push notification service',
    );
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
    const minBatteryLevel = 15;

    // Flower Care & Netatmo devices
    serviceHelper.log('trace', 'Flower Care & Netatmo devices');
    const SQL = 'SELECT battery, location, device FROM vw_battery_data';
    serviceHelper.log('trace', 'Connect to data store connection pool');
    const dbConnection = await serviceHelper.connectToDB('devices');
    const dbClient = await dbConnection.connect(); // Connect to data store
    serviceHelper.log('trace', 'Get battery data from data store');
    const results = await dbClient.query(SQL);
    serviceHelper.log(
      'trace',
      'Release the data store connection back to the pool',
    );
    await dbClient.release(); // Return data store connection back to pool
    await dbClient.end(); // Close data store connection
    // If no data create empty rows array
    if (results.rowCount === 0) {
      results.rows = [];
    }

    // Link-tap device
    serviceHelper.log('trace', 'Link-tap device');
    const url = 'https://www.link-tap.com/api/getAllDevices';
    const LinkTapUser = await serviceHelper.vaultSecret(process.env.ENVIRONMENT, 'LinkTapUser');
    const LinkTapKey = await serviceHelper.vaultSecret(process.env.ENVIRONMENT, 'LinkTapKey');
    if (LinkTapUser instanceof Error || LinkTapKey instanceof Error) {
      serviceHelper.log('error', 'Not able to get secret (Link Tab Info) from vault');
      return;
    }
    const body = {
      username: LinkTapUser,
      apiKey: LinkTapKey,
    };
    const linkTapData = await serviceHelper.callAPIServicePut(url, body);
    if (linkTapData instanceof Error) {
      serviceHelper.log('error', 'LinkTap: Unable to get LinkTap data');
    } else {
      let batteryLevel = linkTapData.devices[0].taplinker[0].batteryStatus;
      batteryLevel = Number(batteryLevel.slice(0, -1));
      const linkTapBatteryData = {
        battery: batteryLevel,
        location: 'Garden',
        device: 'LinkTap',
      };
      results.rows.push(linkTapBatteryData);
      results.rowCount = 1;
    }

    if (results.rowCount === 0) {
      serviceHelper.log('warn', 'No battery data in the last hour');
      processData('No 🔋data in the last hour');
      return;
    }
    // Filter out ok battery readings
    serviceHelper.log('trace', 'Filtering out ok battery readings');
    const lowBattery = results.rows.filter(
      (rec) => rec.battery < minBatteryLevel,
    );

    let message = '🔋levels low:\r\n';
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
