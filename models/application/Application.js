const crypto = require('crypto');
const {Model} = require('../../util/database/Model');

/**
 * @property {string} id
 * @property {string} owner_id
 * @property {string} display_name
 * @property {boolean} active
 * @property {string} token
 * @property {number|null} quota
 */
class Application extends Model {
	static get table() {
		return 'applications';
	}

	static get model() {
		return {
			id: {
				type: 'SNOWFLAKE'
			},
			owner_id: {
				type: 'BIGINT',
				notNull: true
			},
			display_name: {
				type: 'VARCHAR(64)',
				notNull: true,
				validate(value) {
					return typeof value === 'string' && value.length >= 3 && value.length <= 64;
				}
			},
			active: {
				type: 'BOOLEAN',
				notNull: true,
				default: true
			},
			token: {
				type: 'VARCHAR(32)',
				notNull: true
			},
			quota: {
				type: 'INTEGER',
				validate(value) {
					return [undefined, null].includes(value) ? true : (value >= 0 && value <= 2 ** 31);
				}
			},
			updated_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			}
		};
	}

	static generateToken() {
		return crypto.randomBytes(16).toString('hex');
	}
}

module.exports = Application;
