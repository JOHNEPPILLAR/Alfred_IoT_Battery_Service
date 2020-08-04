/**
 * Import external libraries
 */
const { Service } = require('alfred-base');

// Setup service options
const { version } = require('../../package.json');
const serviceName = require('../../package.json').description;
const namespace = require('../../package.json').name;

const options = {
  serviceName,
  namespace,
  serviceVersion: version,
};

// Bind schedule functions to base class
Object.assign(Service.prototype, require('../schedules/battery'));

// Create base service
const service = new Service(options);

async function setupServer() {
  // Setup service
  await service.createRestifyServer();

  if (process.env.MOCK === 'true') {
    this.logger.info('Mocking enabled, will not run battery check schedule');
  } else {
    // Add schedules
    await service.setupSchedules();
  }

  // Listen for api requests
  service.listen();
}
setupServer();
