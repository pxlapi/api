const cluster = require('cluster');
const Sentry = require('@sentry/node');
const Master = require('./cluster/Master');
const Worker = require('./cluster/Worker');
const Logger = require('./util/log/Logger');

class pxlAPI {
	constructor() {
		if (!process.env.NODE_ENV)
			process.env.NODE_ENV = 'dev';
		if (!['dev', 'test', 'production'].includes(process.env.NODE_ENV))
			throw new Error('Invalid Node environment');

		if (process.env.NODE_ENV !== 'dev') {
			Sentry.init({
				dsn: 'https://c0f9b0fdeb414b97a71df17b06ad4121@o499021.ingest.sentry.io/5577101',
				environment: process.env.NODE_ENV
			});
		}

		process.setMaxListeners(0);
		process.on('warning', warning => Logger.warn(warning));
		process.on('unhandledRejection', reason => Logger.error('Unhandled promise rejection', reason));

		if (cluster.isMaster)
			void Master.run();
		else
			void Worker.run();
	}
}

module.exports = new pxlAPI();
