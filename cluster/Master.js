const cluster = require('cluster');
const os = require('os');
const readline = require('readline');
const fs = require('fs/promises');
const path = require('path');
const {promisify} = require('util');
const postgres = require('pg');
const redis = require('redis');
const Logger = require('../util/log/Logger');
const ConfigManager = require('../util/config/Manager');
const CacheEntry = require('../util/database/CacheEntry');
const TaskScheduler = require('../util/scheduler/Scheduler');
const Mailer = require('../util/mail/Mailer');
const {EPOCH} = require('../util/Constants');

class Master {
	static async run() {
		this.config = new ConfigManager();
		this.mailer = new Mailer(this.config.mail);

		if (process.argv.includes('--prepare') || process.env['PXLAPI_PREPARE'])
			await this.prepareDatabase();
		else
			this.setupDatabase();

		this.redis = redis.createClient(this.config.cache);

		this.redisSub = redis.createClient(this.config.cache);
		this.redisSub.subscribe('logs');
		this.redisSub.on('message', (channel, data) => {
			data = JSON.parse(data);
			for (const worker of Object.values(cluster.workers))
				worker.send({type: channel, data});
		});

		new TaskScheduler(this.databasePool, this.mailer);

		this.watchdog = {};
		setInterval(this.runWatchdog.bind(this), 1000);

		cluster.on('message', this.handleIPCMessage.bind(this));
		cluster.on('exit', (worker, code) => this.onWorkerExit(worker, code));
		this.spawnWorkers(process.env.NUMBER_OF_PROCESSORS);
	}

	static onWorkerExit(worker, code) {
		delete this.watchdog[worker.process.pid];
		Logger[code === 0 ? 'warn' : 'error'](`Worker ${worker.process.pid} exited with code ${code}`);
		cluster.fork();
	}

	static spawnWorkers(count = os.cpus().length) {
		Logger.info(`Spawning ${count} workers...`);
		for (let i = 0; i < count; i++) {
			const worker = cluster.fork();
			this.watchdog[worker.process.pid] = Date.now();
		}
	}

	static async handleIPCMessage(worker, message) {
		const {nonce, type} = message;
		const reply = {nonce, type, error: false, response: true};

		switch (type) {
			case 'watchdog': {
				this.watchdog[worker.process.pid] = Date.now();
				break;
			}

			case 'sql': {
				const {query, parameters, transaction} = message;
				if (transaction) {
					if (!query) {
						await this.transactions[transaction].release();
						delete this.transactions[transaction];
						return worker.send(reply);
					}

					try {
						if (!this.transactions[transaction]) {
							this.transactions[transaction] = await this.databasePool.connect();
							await this.transactions[transaction].query('BEGIN');
						}

						reply.result = await this.transactions[transaction].query(query, parameters);
					} catch (err) {
						reply.error = true;
						reply.result = err.message;
					}
				} else {
					try {
						reply.result = await this.databasePool.query(query, parameters);
					} catch (err) {
						reply.error = true;
						reply.result = err.message;
					}
				}

				break;
			}

			case 'redis': {
				const {action, key, value, expiresIn} = message;
				let result;
				try {
					if (action === 'get') {
						result = await promisify(this.redis.get).call(this.redis, key);
						if (result !== null)
							result = JSON.parse(result);
					} else if (action === 'set') {
						if (expiresIn !== undefined) { // noinspection JSUnresolvedVariable
							result = await promisify(this.redis.setex).call(this.redis, key, ~~(expiresIn / 1000), JSON.stringify(value));
						} else
							result = await promisify(this.redis.set).call(this.redis, key, JSON.stringify(value));
					} else if (action === 'publish')
						result = await promisify(this.redis.publish).call(this.redis, key, JSON.stringify(value));
				} catch (err) {
					reply.error = true;
					reply.result = err.message;
				}

				reply.result = result;
				break;
			}
		}

		worker.send(reply);
	}

	static runWatchdog() {
		for (const worker of Object.values(cluster.workers)) {
			const offset = Date.now() - this.watchdog[worker.process.pid];

			if (offset > 30000) {
				Logger.error(`Worker ${worker.process.pid} hasn't sent a heartbeat in 30s, killing..`);
				worker.process.kill('SIGKILL');
			} else if (offset > 20000 && offset < 21000) {
				Logger.error(`Worker ${worker.process.pid} hasn't sent a heartbeat in 20s, terminating..`);
				worker.process.kill('SIGTERM');
			} else if (offset > 10000 && offset < 11000)
				Logger.warn(`Worker ${worker.process.pid} hasn't sent a heartbeat in 10s`);
		}
	}

	static async prepareDatabase() {
		const masterClient = new postgres.Client(Object.assign({}, this.config.database, {database: 'postgres'}));
		await masterClient.connect();
		try {
			await masterClient.query(`CREATE DATABASE ${this.config.database.database}`);
		} catch (err) {
			if (!err.message.includes('already exists')) throw err;
			if (process.env.NODE_ENV !== 'dev')
				return Logger.error(`Database ${this.config.database.database} already exists! Refusing to delete because Node environment is not dev.`);

			const readlineInterface = new readline.Interface(process.stdin, process.stdout);
			const confirmation = await new Promise(resolve => readlineInterface.question(`${Logger.prefix} \u001b[33mDatabase ${this.config.database.database} already exists! Do you want to delete it? [y/N]\u001b[0m `, answer => resolve(answer.toLowerCase() === 'y')));
			readlineInterface.close();
			if (!confirmation)
				return process.exit(0);

			Logger.info(`Preparing: Dropping database ${this.config.database.database}`);
			try {
				await masterClient.query(`DROP DATABASE ${this.config.database.database}`);
			} catch (err) {
				Logger.error(`Preparing: Failed to drop database: ${err.message}`);
				process.exit(1);
			}
			await masterClient.query(`CREATE DATABASE ${this.config.database.database}`);
		}

		Logger.info(`Preparing: Created database ${this.config.database.database}`);
		await masterClient.end();

		this.setupDatabase();
		await this.prepareModels();

		Logger.success('Preparing: Done!');
	}

	static async prepareModels() {
		const queries = {
			CREATE_SNOWFLAKE: `CREATE SEQUENCE snowflake_generator_sequence MINVALUE 0 MAXVALUE 65535 CYCLE;
			CREATE OR REPLACE FUNCTION snowflake_generator(OUT result BIGINT) AS $$
			DECLARE
				epoch bigint := ${EPOCH};
				cur_millis bigint;
				seq_id bigint;
			BEGIN
				SELECT FLOOR(EXTRACT(EPOCH FROM now()) * 1000) INTO cur_millis;
				SELECT nextval('snowflake_generator_sequence') INTO seq_id;
				result := (cur_millis - epoch) << 16;
				result := result | (seq_id);
			END;
			$$ LANGUAGE PLPGSQL;`,
			REGISTER_SNOWFLAKE: 'CREATE DOMAIN snowflake BIGINT DEFAULT snowflake_generator() NOT NULL',
			SNOWFLAKE_TO_TIMESTAMP: `CREATE OR REPLACE FUNCTION snowflake_to_timestamp(IN snowflake BIGINT, OUT result TIMESTAMPTZ) AS $$
				DECLARE
					epoch bigint := 1577836800000;
					epoch_offset bigint;
				BEGIN
					SELECT snowflake >> 16 INTO epoch_offset;
					result := TO_TIMESTAMP((epoch_offset + epoch) / 1000);
				END;
			$$ LANGUAGE PLPGSQL;`
		};

		const scanModels = async (directory) => {
			for (const modelFile of await fs.readdir(directory)) {
				const modulePath = path.resolve(directory, modelFile);
				if ((await fs.lstat(modulePath)).isDirectory()) {
					await scanModels(modulePath);
					continue;
				}

				const model = require(modulePath);
				if (CacheEntry.isPrototypeOf(model))
					continue;
				if (!model.table)
					continue;
				queries[`CREATE_${model.table.toUpperCase()}_MODEL`] = model.buildQuery();
			}
		};

		await scanModels('./models');

		for (const queryName of Object.keys(queries)) {
			Logger.info(`Preparing: Running routine for ${queryName}`);
			await this.databasePool.query(queries[queryName]);
		}
	}

	static setupDatabase() {
		const originalIntervalParser = postgres.types.getTypeParser(1186);
		postgres.types.setTypeParser(1186, interval => {
			const {years, months, days, hours, minutes, seconds, milliseconds} = Object.assign(
				{years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0},
				originalIntervalParser(interval)
			);

			return ((((((years * 12 + months) * 30 + days) * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000) + milliseconds;
		});

		this.databasePool = new postgres.Pool(this.config.database);
		/** @type {{[number]: postgres.Client}} */
		this.transactions = {};
	}
}

module.exports = Master;
