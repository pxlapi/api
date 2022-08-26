const cluster = require('cluster');
const Sentry = require('@sentry/node');

class Logger {
	static log(...message) {
		if (process.env.NODE_ENV === 'production') return;
		console.log(this.prefix, ...message);
	}

	static success(...message) {
		if (process.env.NODE_ENV === 'production') return;
		console.log(this.prefix + '\u001b[32m', ...message, '\u001b[0m');
	}

	static info(...message) {
		if (process.env.NODE_ENV === 'production') return;
		console.log(this.prefix + '\u001b[36m', ...message, '\u001b[0m');
	}

	static warn(...message) {
		this.warnSilent(...message);
		if (process.env.NODE_ENV === 'dev') return;
		Sentry.captureException(new Error(`WARNING: ${message instanceof Error ? message.stack : message}`));
	}

	static warnSilent(...message) {
		console.warn(this.prefix + '\u001b[33m', ...message, '\u001b[0m');
	}

	static error(...message) {
		this.errorSilent(...message);
		if (process.env.NODE_ENV === 'dev') return;
		Sentry.captureException(message instanceof Error ? message : new Error(message));
	}

	static errorSilent(...message) {
		console.error(this.prefix + '\u001b[31m', ...message, '\u001b[0m');
	}
}

Logger.prefix = `[${cluster.isMaster ? '\u001b[35mmaster' : '\u001b[34mworker'}\u001b[0m.${process.pid}${' '.repeat(5 - process.pid.toString().length)}]`;

module.exports = Logger;
