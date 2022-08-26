const {Model} = require('../../util/database/Model');

class ReferralCode extends Model {
	static get table() {
		return 'referral_codes';
	}

	static get model() {
		return {
			name: {
				type: 'VARCHAR(32)',
				primaryKey: true,
				notNull: true
			},
			credit_amount: {
				type: 'INTEGER',
				notNull: true
			},
			max_redemptions: {
				type: 'INTEGER'
			},
			active: {
				type: 'BOOLEAN',
				notNull: true,
				default: true
			}
		};
	}
}

module.exports = ReferralCode;
