#!/usr/bin/env node

const schema = require('./schema');
const logger = require('./logger').global;

const IP_RANGES_FETCH_ENABLED = process.env.IP_RANGES_FETCH_ENABLED !== 'false';

async function appStart () {
	const migrate             = require('./migrate');
	const setup               = require('./setup');
	const app                 = require('./app');
	const internalCertificate = require('./internal/certificate');
	const internalIpRanges    = require('./internal/ip_ranges');

	return migrate.latest()
		.then(setup)
		.then(schema.getCompiledSchema)
		.then(() => {
			if (IP_RANGES_FETCH_ENABLED) {
				logger.info('IP Ranges fetch is enabled');
				return internalIpRanges.fetch().catch((err) => {
					logger.error('IP Ranges fetch failed, continuing anyway:', err.message);
				});
			} else {
				logger.info('IP Ranges fetch is disabled by environment variable');
			}
		})
		.then(() => {
			internalCertificate.initTimer();
			internalIpRanges.initTimer();

			const server = app.listen(3000, () => {
				logger.info('Backend PID ' + process.pid + ' listening on port 3000 ...');

				process.on('SIGTERM', () => {
					logger.info('PID ' + process.pid + ' received SIGTERM');
					server.close(() => {
						logger.info('Stopping.');
						process.exit(0);
					});
				});
			});
		})
		.catch((err) => {
			logger.error(err.message, err);
			setTimeout(appStart, 1000);
		});
}

try {
	appStart();
} catch (err) {
	logger.error(err.message, err);
	process.exit(1);
}

