const crypto = require('crypto');
const {Model} = require('../../util/database/Model');

/**
 * @property {string} token
 * @property {string} user_id
 */
class VerificationToken extends Model {
	static get table() {
		return 'verification_tokens';
	}

	static get model() {
		return {
			token: {
				type: 'VARCHAR(8)',
				primaryKey: true
			},
			user_id: {
				type: 'BIGINT',
				notNull: true
			},
			created_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			}
		};
	}

	static generateToken() {
		return crypto.randomBytes(4).toString('hex');
	}
}

module.exports = VerificationToken;
