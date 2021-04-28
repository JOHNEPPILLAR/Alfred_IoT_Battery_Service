/**
 * Import external libraries
 */
const debug = require('debug')('Battery:Schedules');

async function callDB(db, collection, groupBy, minBatteryLevel) {
  let dbConnection;
  try {
    debug(`Connect to DB`);
    dbConnection = await this._connectToDB();
    const aggregate = [
      { $sort: { time: 1 } },
      {
        $group: {
          _id: `$${groupBy}`,
          battery: { $last: '$battery' },
          location: { $last: '$location' },
        },
      },
      {
        $match: {
          battery: { $lt: minBatteryLevel },
        },
      },
    ];
    debug(`Query DB`);
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
    try {
      debug(`Close DB connection`);
      await dbConnection.close();
    } catch (err) {
      debug('Not able to close DB');
    }
  }
}

/**
 * Get battery data for last hour
 */
async function getBatteryData() {
  let batteryLow = false;

  // Arlo battery info
  try {
    debug(`Arlo battery info`);
    const results = await callDB.call(
      this,
      'alfred_hls_service',
      'alfred_hls_service',
      'device',
      15,
    );
    debug(results);
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Arlo - ${results[0].location} (${results[0].battery}%)`;
      debug(message);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Flower care battery info
  try {
    debug(`Flower care battery info`);
    const results = await callDB.call(
      this,
      'alfred_flowercare_data_collector_service',
      'alfred_flowercare_data_collector_service',
      'plant',
      10,
    );
    debug(results);
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      results.map((device) => {
        const message = `⚡🔋 low: Flower care - ${device.location} (${device.battery}%)`;
        debug(message);
        this._sendPushNotification.call(this, message);
        return true;
      });
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Netatmo battery info
  try {
    debug(`Netatmo battery info`);
    const results = await callDB.call(
      this,
      'alfred_netatmo_data_collector_service',
      'alfred_netatmo_data_collector_service',
      'device',
      15,
    );
    debug(results);
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Netatmo - ${results[0].location} (${results[0].battery}%)`;
      debug(message);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Light dimmer battery info
  try {
    debug(`Light dimmer battery info`);
    const results = await callDB.call(
      this,
      'alfred_lights_service',
      'alfred_lights_service',
      'device',
      10,
    );
    debug(results);
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Light dimmer - ${results[0].location} (${results[0].battery}%)`;
      debug(message);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Ring door bell battery info
  try {
    debug(`Ring door bell battery info`);
    const results = await callDB.call(
      this,
      'alfred_ring_data_collector_service',
      'alfred_ring_data_collector_service',
      'device',
      20,
    );
    debug(results);
    if (results instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${results.message}`);
    } else if (results.length > 0) {
      batteryLow = true;
      const message = `⚡🔋 low: Ring door bell - ${results[0].location} (${results[0].battery}%)`;
      debug(message);
      this._sendPushNotification.call(this, message);
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }

  // Link-tap battery info
  try {
    debug(`Link-tap battery info`);

    const url = 'https://www.link-tap.com/api/getAllDevices';
    const LinkTapUser = await this._getVaultSecret('LinkTapUser');
    const LinkTapKey = await this._getVaultSecret('LinkTapKey');

    if (LinkTapUser instanceof Error || LinkTapKey instanceof Error) {
      const err = new Error(
        'Not able to get secret (Link Tab Info) from vault',
      );
      throw err;
    }

    debug('Request data from api');
    const body = {
      username: LinkTapUser,
      apiKey: LinkTapKey,
    };
    const minBatteryLevel = 15;
    const linkTapData = await this._callAPIServicePost.call(this, url, body);
    if (linkTapData instanceof Error)
      throw new Error('LinkTap: Unable to get LinkTap data');
    else {
      let batteryLevel = linkTapData.devices[0].taplinker[0].batteryStatus;
      batteryLevel = Number(batteryLevel.slice(0, -1));
      if (batteryLevel < minBatteryLevel) {
        batteryLow = true;
        const message = `⚡🔋 low: LinkTap - Garden Zone 1 (${batteryLevel}%)`;
        debug(message);
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
    debug(`Clear current schedules`);
    this.schedules = [];

    // Check battery levels now
    getBatteryData.call(this);

    debug('Setup battery check schedules');
    debug(`Register battery check schedule`);
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
