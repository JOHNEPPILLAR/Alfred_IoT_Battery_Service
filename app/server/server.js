/**
 * Import external libraries
 */
require('dotenv').config();

const restify = require('restify');
const fs = require('fs');
const UUID = require('pure-uuid');
const { Pool } = require('pg');
const serviceHelper = require('alfred-helper');
const { version } = require('../../package.json');

/**
 * Import helper libraries
 */
const scheduleController = require('../schedules/controller.js');

// Get up global vars
global.deviceDataClient = new Pool({
  host: process.env.DataStore,
  database: 'devices',
  user: process.env.DataStoreUser,
  password: process.env.DataStoreUserPassword,
  port: 5432,
});

global.APITraceID = '';

// Restify server Init
const server = restify.createServer({
  name: process.env.ServiceName,
  version,
  key: fs.readFileSync('./certs/server.key'),
  certificate: fs.readFileSync('./certs/server.crt'),
});

/**
 * Setup API middleware
 */
server.use(restify.plugins.jsonBodyParser({ mapParams: true }));
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser({ mapParams: true }));
server.use(restify.plugins.fullResponse());
server.use((req, res, next) => {
  serviceHelper.log('trace', req.url);
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self' ${process.env.ServiceDomain}`,
  );
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
server.use((req, res, next) => {
  // Check for a trace id
  if (typeof req.headers['api-trace-id'] === 'undefined') {
    global.APITraceID = new UUID(4);
  } else {
    global.APITraceID = req.headers['api-trace-id'];
  }

  // Check for valid auth key
  if (req.headers['client-access-key'] !== process.env.ClientAccessKey) {
    serviceHelper.log(
      'warn',
      `Invaid client access key: ${req.headers.ClientAccessKey}`,
    );
    serviceHelper.sendResponse(
      res,
      401,
      'There was a problem authenticating you.',
    );
    return;
  }
  next();
});

server.on('NotFound', (req, res, err) => {
  serviceHelper.log('error', `${err.message}`);
  serviceHelper.sendResponse(res, 404, err.message);
});
server.on('uncaughtException', (req, res, route, err) => {
  serviceHelper.log('error', `${route}: ${err.message}`);
  serviceHelper.sendResponse(res, null, err.message);
});

/**
 * Configure API end points
 */
require('../api/root/root.js').applyRoutes(server);

/**
 * Stop server if process close event is issued
 */
async function cleanExit() {
  serviceHelper.log('warn', 'Service stopping');
  serviceHelper.log('warn', 'Closing the data store pools');
  try {
    await global.deviceDataClient
      .end()
      .then(() => serviceHelper.log('trace', 'client has disconnected'))
      .catch((err) => serviceHelper.log('error', err.stack));
  } catch (err) {
    serviceHelper.log('warn', 'Failed to close the data store connection');
  }
  serviceHelper.log('warn', 'Close rest server');
  server.close(() => {
    // Ensure rest server is stopped
    serviceHelper.log('warn', 'Exit the app');
    process.exit(); // Exit app
  });
}
process.on('SIGINT', () => {
  cleanExit();
});
process.on('SIGTERM', () => {
  cleanExit();
});
process.on('SIGUSR2', () => {
  cleanExit();
});
process.on('uncaughtException', (err) => {
  if (err) serviceHelper.log('error', err.message); // log the error
  cleanExit();
});

/**
 * Data store error events
 */
global.deviceDataClient.on('error', (err) => {
  serviceHelper.log(
    'error',
    'Device data store: Unexpected error on idle client',
  );
  serviceHelper.log('error', err.message);
  cleanExit();
});

// Setup scheduler
setTimeout(() => {
  scheduleController.collectData();
}, 1000);

// Start service and listen to requests
server.listen(process.env.Port, () => {
  serviceHelper.log(
    'info',
    `${process.env.ServiceName} has started and is listening on port ${process.env.Port}`,
  );
});