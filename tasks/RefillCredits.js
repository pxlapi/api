const Task = require('../util/scheduler/Task');
const User = require('../models/user/User');

class RefillCredits extends Task {
	constructor() {
		super('master');
	}

	async run(database) {
		await database.query(`UPDATE ${User.table} SET monthly_credits = DEFAULT, credit_alert = DEFAULT`);
	}

	get nextRun() {
		const date = new Date();
		date.setMonth(date.getMonth() + 1, 1);
		date.setHours(0, 0, 0, 0);

		return date.valueOf();
	}
}

module.exports = new RefillCredits();
