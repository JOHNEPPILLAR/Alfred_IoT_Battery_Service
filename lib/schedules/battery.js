/**
 * Import external libraries
 */
const moment = require('moment');

const minBatteryLevel = 16;

async function callDB(db, collection) {
  let dbConnection;
  try {
    this.logger.trace(`${this._traceStack()} - Connect to DB`);
    dbConnection = await this._connectToDB();
    const timeBucket = moment().utc().subtract(1, 'hour').toDate();
    const aggregate = [
      {
        $match: {
          time: { $gt: timeBucket },
          battery: { $lt: minBatteryLevel },
        },
      },
      { $sort: { time: 1 } },
    ];
    this.logger.trace(`${this._traceStack()} - Execute query`);
    const results = await dbConnection
      .db(db)
      .collection(collection)
      .aggregate(aggregate)
      .toArray();
    return results;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  } finally {
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
  }
}

/**
 * Get battery data for last hour
 */
async function getBatteryData() {
  let batteryLow = false;

  // Arlo battery info
  try {
    this.logger.trace(`${this._traceStack()} - Arlo battery info`);
    const results = await callDB.call(
      this,
      'alfred_hls_service',
      'alfred_hls_service',
    );
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Arlo - ${results[0].location} (${results[0].battery}%)`;
      this.logger.debug(`${this._traceStack()} - ${message}`);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Flower care battery info
  try {
    this.logger.trace(`${this._traceStack()} - Flower care battery info`);
    const results = await callDB.call(
      this,
      'alfred_flowercare_data_collector_service',
      'alfred_flowercare_data_collector_service',
    );
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      this.results.map((device) => {
        const message = `⚡🔋 low: Flower care - ${device.location} (${device.battery}%)`;
        this.logger.debug(`${this._traceStack()} - ${message}`);
        this._sendPushNotification.call(this, message);
        return true;
      });
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Netatmo battery info
  try {
    this.logger.trace(`${this._traceStack()} - Netatmo battery info`);
    const results = await callDB.call(
      this,
      'alfred_netatmo_data_collector_service',
      'alfred_netatmo_data_collector_service',
    );
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Netatmo - ${results[0].location} (${results[0].battery}%)`;
      this.logger.debug(`${this._traceStack()} - ${message}`);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Light dimmer battery info
  try {
    this.logger.trace(`${this._traceStack()} - Light dimmer battery info`);
    const results = await callDB.call(
      this,
      'alfred_lights_service',
      'alfred_lights_service',
    );
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Light dimmer - ${results[0].location} (${results[0].battery}%)`;
      this.logger.debug(`${this._traceStack()} - ${message}`);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Ring door bell battery info
  try {
    this.logger.trace(`${this._traceStack()} - Ring door bell battery info`);
    const results = await callDB.call(
      this,
      'alfred_ring_data_collector_service',
      'alfred_ring_data_collector_service',
    );
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Ring door bell - ${results[0].location} (${results[0].battery}%)`;
      this.logger.debug(`${this._traceStack()} - ${message}`);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Link-tap battery info
  try {
    this.logger.trace(`${this._traceStack()} - Link-tap battery info`);

    const url = 'https://www.link-tap.com/api/getAllDevices';
    const LinkTapUser = await this._getVaultSecret('LinkTapUser');
    const LinkTapKey = await this._getVaultSecret('LinkTapKey');

    if (LinkTapUser instanceof Error || LinkTapKey instanceof Error) {
      const err = new Error(
        'Not able to get secret (Link Tab Info) from vault',
      );
      throw err;
    }
    const body = {
      username: LinkTapUser,
      apiKey: LinkTapKey,
    };
    const linkTapData = await this._callAPIServicePut.call(this, url, body);
    if (linkTapData instanceof Error) {
      const err = new Error('LinkTap: Unable to get LinkTap data');
      throw err;
    } else {
      // Zone 1
      let batteryLevel = linkTapData.devices[0].taplinker[0].batteryStatus;
      batteryLevel = Number(batteryLevel.slice(0, -1));
      if (batteryLevel < minBatteryLevel) {
        batteryLow = true;
        const message = `⚡🔋 low: LinkTap - Garden Zone 1 (${batteryLevel}%)`;
        this.logger.debug(`${this._traceStack()} - ${message}`);
        this._sendPushNotification.call(this, message);
      }

      // Zone 2
      batteryLevel = linkTapData.devices[0].taplinker[1].batteryStatus;
      batteryLevel = Number(batteryLevel.slice(0, -1));
      if (batteryLevel < minBatteryLevel) {
        batteryLow = true;
        const message = `⚡🔋 low: LinkTap - Garden Zone 2 (${batteryLevel}%)`;
        this.logger.debug(`${this._traceStack()} - ${message}`);
        this._sendPushNotification.call(this, message);
      }
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // No low barrery event
  if (!batteryLow) this.logger.info('All battery levels ok');
}

async function setupSchedules() {
  try {
    // Clear current schedules array
    this.logger.debug(`${this._traceStack()} - Clear current schedules`);
    this.schedules = [];

    // Check battery levels now
    getBatteryData.call(this);

    this.logger.debug('Setup battery check schedules');
    this.logger.trace(
      `${this._traceStack()} - Register battery check schedule`,
    );
    await this.schedules.push({
      hour: 19,
      minute: 0,
      description: 'Battery check',
      functionToCall: getBatteryData,
    });

    // Activate schedules
    await this.activateSchedules();
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

module.exports = {
  setupSchedules,
};
