const {Model} = require('../../util/database/Model');

class Payment extends Model {
	static get table() {
		return 'payments';
	}

	static get model() {
		return {
			id: {
				type: 'TEXT',
				notNull: true,
				primaryKey: true
			},
			user_id: {
				type: 'BIGINT',
				notNull: true
			},
			amount_credits: {
				type: 'INTEGER',
				notNull: true
			},
			amount_usd: {
				type: 'MONEY',
				notNull: true
			},
			status: {
				type: 'TEXT',
				notNull: true
			},
			created_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			},
			updated_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			}
		};
	}
}

module.exports = Payment;
