/**
 * Import external libraries
 */
const serviceHelper = require('alfred-helper');

async function callDB(db, sql) {
  serviceHelper.log(
    'trace',
    'Connect to data store connection pool',
  );
  const dbConnection = await serviceHelper.connectToDB(db);
  serviceHelper.log(
    'trace',
    'Get data from data store',
  );
  const dbResults = await dbConnection.query(sql);
  serviceHelper.log(
    'trace',
    'Release the data store connection back to the pool',
  );
  dbConnection.end();

  return dbResults;
}

/**
 * Get battery data for last hour
 */
exports.getData = async () => {
  try {
    const minBatteryLevel = 15;
    const results = [];

    // Arlo battery info
    serviceHelper.log(
      'trace',
      'Arlo battery info',
    );
    const sql = 'SELECT battery, location, device FROM vw_battery_data';
    let tempResults = await callDB('arlo', sql);
    if (tempResults.rowCount !== 0) results.push(tempResults.rows);

    // Flower Care battery info
    serviceHelper.log(
      'trace',
      'Flower Care battery info',
    );

    tempResults = await callDB('flowercare', sql);
    if (tempResults.rowCount !== 0) results.push(tempResults.rows);

    // Netatmo battery info
    serviceHelper.log(
      'trace',
      'Netatmo battery info',
    );

    tempResults = await callDB('netatmo', sql);
    if (tempResults.rowCount !== 0) results.push(tempResults.rows);

    // Link-tap
    serviceHelper.log(
      'trace',
      'Link-tap device',
    );
    const url = 'https://www.link-tap.com/api/getAllDevices';
    const LinkTapUser = await serviceHelper.vaultSecret(
      process.env.ENVIRONMENT,
      'LinkTapUser',
    );
    const LinkTapKey = await serviceHelper.vaultSecret(
      process.env.ENVIRONMENT,
      'LinkTapKey',
    );
    if (LinkTapUser instanceof Error || LinkTapKey instanceof Error) {
      serviceHelper.log(
        'error',
        'Not able to get secret (Link Tab Info) from vault',
      );
      return;
    }
    const body = {
      username: LinkTapUser,
      apiKey: LinkTapKey,
    };
    const linkTapData = await serviceHelper.callAPIServicePut(url, body);
    if (linkTapData instanceof Error) {
      serviceHelper.log(
        'error',
        'LinkTap: Unable to get LinkTap data',
      );
    } else {
      let batteryLevel = linkTapData.devices[0].taplinker[0].batteryStatus;
      batteryLevel = Number(batteryLevel.slice(0, -1));
      let linkTapBatteryData = {
        battery: batteryLevel,
        location: 'Garden Zone 1',
        device: 'LinkTap',
      };
      results.push(linkTapBatteryData);

      batteryLevel = linkTapData.devices[0].taplinker[1].batteryStatus;
      batteryLevel = Number(batteryLevel.slice(0, -1));
      linkTapBatteryData = {
        battery: batteryLevel,
        location: 'Garden zone 2',
        device: 'LinkTap',
      };
      results.push(linkTapBatteryData);
    }

    if (results.length === 0) {
      serviceHelper.log(
        'warn',
        'No battery data in the last hour',
      );
      serviceHelper.sendPushNotification('No 🔋data in the last hour');
      return;
    }
    // Filter out ok battery readings
    serviceHelper.log(
      'trace',
      'Filtering out ok battery readings',
    );
    const lowBattery = results.filter((rec) => rec.battery < minBatteryLevel);

    let message = '🔋levels low:\r\n';
    lowBattery.map((device) => {
      message = `${message}${device.device} - ${device.location} (${device.battery}%)\r\n`;
      return true;
    });
    if (lowBattery.length > 0) {
      serviceHelper.sendPushNotification(message);
    } else {
      serviceHelper.log(
        'info',
        'All battery levels ok',
      );
    }
  } catch (err) {
    serviceHelper.log(
      'error',
      err.message,
    );
  }
};
