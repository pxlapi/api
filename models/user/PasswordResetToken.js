const crypto = require('crypto');
const {Model} = require('../../util/database/Model');

/**
 * @property {string} token
 * @property {string} user_id
 * @property {string} expires_at
 */
class PasswordResetToken extends Model {
	static get table() {
		return 'password_reset_tokens';
	}

	static get model() {
		return {
			token: {
				type: 'VARCHAR(12)',
				primaryKey: true
			},
			user_id: {
				type: 'BIGINT',
				notNull: true
			},
			created_at: {
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
		return crypto.randomBytes(6).toString('hex');
	}
}

module.exports = PasswordResetToken;
