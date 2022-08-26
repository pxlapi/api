const Task = require('../util/scheduler/Task');
const AccessToken = require('../models/user/AccessToken');
const PasswordResetToken = require('../models/user/PasswordResetToken');
const Logger = require('../util/log/Logger');

class DeleteExpiredRecords extends Task {
	constructor() {
		super('master');
	}

	async run(database) {
		const promises = [AccessToken, PasswordResetToken].map(model =>
			database
				.query(`WITH deleted AS (DELETE FROM ${model.table} WHERE expires_at < now() RETURNING *) SELECT count(*) FROM deleted`)
				.then(r => r.rows[0].count)
		);

		const [accessTokenCount, passwordResetTokenCount] = await Promise.all(promises);

		Logger.info(`Deleted ${accessTokenCount} access tokens and ${passwordResetTokenCount} password reset tokens`);
	}

	get nextRun() {
		const date = new Date();
		date.setDate(date.getDate() + 1);
		date.setHours(0, 0, 0, 0);

		return date.valueOf();
	}
}

module.exports = new DeleteExpiredRecords();
