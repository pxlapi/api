const crypto = require('crypto');
const {Model} = require('../../util/database/Model');

/**
 * @property {string} token
 * @property {string} user_id
 * @property {Date} created_at
 * @property {Date} updated_at
 * @property {Date} expires_at
 * @property {string[]} remote_addresses
 */
class AccessToken extends Model {
	static get table() {
		return 'access_tokens';
	}

	static get model() {
		return {
			token: {
				type: 'VARCHAR(32)',
				primaryKey: true
			},
			user_id: {
				type: 'BIGINT',
				notNull: true
			},
			remote_addresses: {
				type: 'INET[]',
				notNull: true
			},
			location: {
				type: 'TEXT'
			},
			created_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			},
			updated_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			},
			expires_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			}
		};
	}

	static generateToken() {
		return crypto.randomBytes(16).toString('hex');
	}
}

module.exports = AccessToken;
