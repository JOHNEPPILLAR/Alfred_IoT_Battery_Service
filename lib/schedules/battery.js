async function callDB(db, sql) {
  this.logger.trace(
    `${this._traceStack()} - Connect to data store connection pool`,
  );
  const dbConnection = await this._connectToDB(db);
  this.logger.trace(`${this._traceStack()} - Get data from data store`);
  const dbResults = await dbConnection.query(sql);
  this.logger.trace(
    `${this._traceStack()} - Release the data store connection back to the pool`,
  );
  dbConnection.end();

  return dbResults;
}

/**
 * Get battery data for last hour
 */
async function getBatteryData() {
  try {
    const minBatteryLevel = 15;
    const results = [];

    // Arlo battery info
    this.logger.trace(`${this._traceStack()} - Arlo battery info`);
    const sql =
      "SELECT last(battery, time) as battery, last(location, time) as location, last(device, time) as device FROM vw_battery_data WHERE time > NOW() - interval '1 day'";
    let tempResults = await callDB.call(this, 'arlo', sql);
    if (tempResults.rows[0].battery !== null) results.push(tempResults.rows);

    // Flower Care battery info
    this.logger.trace(`${this._traceStack()} - Flower Care battery info`);
    tempResults = await callDB.call(this, 'flowercare', sql);
    if (tempResults.rows[0].battery !== null) results.push(tempResults.rows);

    // Netatmo battery info
    this.logger.trace(`${this._traceStack()} - Netatmo battery info`);
    tempResults = await callDB.call(this, 'netatmo', sql);
    if (tempResults.rows[0].battery !== null) results.push(tempResults.rows);

    // Link-tap
    this.logger.trace(`${this._traceStack()} - Link-tap battery info`);
    const url = 'https://www.link-tap.com/api/getAllDevices';
    const LinkTapUser = await this._getVaultSecret('LinkTapUser');
    const LinkTapKey = await this._getVaultSecret('LinkTapKey');
    if (LinkTapUser instanceof Error || LinkTapKey instanceof Error) {
      this.logger.error(
        `${this._traceStack()} - Not able to get secret (Link Tab Info) from vault`,
      );
      return;
    }
    const body = {
      username: LinkTapUser,
      apiKey: LinkTapKey,
    };
    const linkTapData = await this._callAPIServicePut.call(this, url, body);
    if (linkTapData instanceof Error) {
      this.logger.error(
        `${this._traceStack()} - LinkTap: Unable to get LinkTap data`,
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
      this.logger.error(
        `${this._traceStack()} - No battery data recorded today`,
      );
      this._sendPushNotification.call(this, 'No 🔋data recorded today');
      return;
    }
    // Filter out ok battery readings
    this.logger.trace(
      `${this._traceStack()} - Filtering out ok battery readings`,
    );
    const lowBattery = results.filter((rec) => rec.battery < minBatteryLevel);

    let message = '🔋levels low:\r\n';
    lowBattery.map((device) => {
      message = `${message}${device.device} - ${device.location} (${device.battery}%)\r\n`;
      return true;
    });
    if (lowBattery.length > 0) {
      this._sendPushNotification.call(this, message);
    } else {
      this.logger.info('All battery levels ok');
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

async function setupSchedules() {
  try {
    this.logger.info('Setup daily schedules');

    // Cancel any existing schedules
    this.logger.trace(`${this._traceStack()} - Cancel all existing schedules`);
    await this.schedules.map((value) => {
      if (value) value.cancel();
      return true;
    });

    const date = new Date();
    date.setHours(19);
    date.setMinutes(0);
    this._addSchedule(date, 'Battery check', getBatteryData);
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

module.exports = {
  setupSchedules,
};
