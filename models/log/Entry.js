const {Model} = require('../../util/database/Model');

class LogEntry extends Model {
	static get table() {
		return 'logs';
	}

	static get model() {
		return {
			id: {
				type: 'SNOWFLAKE'
			},
			user_id: {
				type: 'BIGINT'
			},
			application_id: {
				type: 'BIGINT'
			},
			controller: {
				type: 'VARCHAR(32)'
			},
			status: {
				type: 'SMALLINT',
				notNull: true
			},
			method: {
				type: 'VARCHAR(8)',
				notNull: true
			},
			remote_addresses: {
				type: 'INET[]',
				notNull: true
			},
			time_taken: {
				type: 'INTERVAL'
			},
			user_agent: {
				type: 'VARCHAR(128)'
			},
			credits_used: {
				type: 'SMALLINT'
			}
		};
	}
}

module.exports = LogEntry;
