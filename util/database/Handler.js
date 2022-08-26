const Logger = require('../log/Logger');
const cluster = require('cluster');

class DatabaseHandler {
	static async query(query, parameters, transactionID) {
		const nonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		const replyPromise = new Promise(resolve => {
			const messageListener = message => {
				if (message.nonce === nonce && message.response)
					return resolve(message);
				process.once('message', messageListener);
			};

			process.once('message', messageListener);
		});

		const payload = {
			nonce,
			type: 'sql',
			transaction: transactionID,
			query,
			parameters
		};

		if (cluster.isWorker)
			process.send(payload);
		else
			cluster.emit('message', {
				send(data) {
					process.emit('message', data);
				}
			}, payload);

		const {result, error} = await replyPromise;
		if (error)
			throw new Error(result);
		return result;
	}
}

class Transaction extends DatabaseHandler {
	constructor(timeout = 30000) {
		super();
		this.id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		this.timeout = setTimeout(() => {
			Logger.warn(`Transaction ${this.id} hasn't finished in ${Math.floor(timeout / 1000)}s`);
			this.timeout = setTimeout(() => {
				Logger.error(`Transaction ${this.id} hasn't finished in ${Math.floor(2 * timeout / 1000)}s, rolling back`);
				void this.rollback();
				this.timeout = undefined;
			}, timeout);
		}, timeout);
	}

	async query(query, parameters) {
		if (!this.timeout)
			throw new Error('Transaction has already completed');
		return await DatabaseHandler.query(query, parameters, this.id);
	}

	async commit() {
		const result = await this.query('COMMIT', []);
		await this.query();
		clearTimeout(this.timeout);
		this.timeout = undefined;
		return result;
	}

	async rollback() {
		const result = await this.query('ROLLBACK', []);
		await this.query();
		clearTimeout(this.timeout);
		this.timeout = undefined;
		return result;
	}
}

module.exports = {DatabaseHandler, Transaction};
