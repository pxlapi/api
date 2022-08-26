const {Model} = require('../../util/database/Model');

class ReferralCodeUse extends Model {
	static get table() {
		return 'referral_code_uses';
	}

	static get model() {
		return {
			name: {
				type: 'VARCHAR(32)',
				primaryKey: true,
				notNull: true
			},
			user_id: {
				type: 'BIGINT',
				primaryKey: true,
				notNull: true
			},
			timestamp: {
				type: 'TIMESTAMPTZ',
				notNull: true
			}
		};
	}
}

module.exports = ReferralCodeUse;
