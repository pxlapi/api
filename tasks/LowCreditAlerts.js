const Task = require('../util/scheduler/Task');
const Logger = require('../util/log/Logger');
const User = require('../models/user/User');
const {Transaction} = require('../util/database/Handler');
const SnowflakeUtils = require('../util/Snowflake');

const SCALES = {MILLISECOND: 1};
SCALES.SECOND = 1000 * SCALES.MILLISECOND;
SCALES.MINUTE = 60 * SCALES.SECOND;
SCALES.HOUR = 60 * SCALES.MINUTE;
SCALES.DAY = 24 * SCALES.HOUR;
SCALES.WEEK = 7 * SCALES.DAY;
SCALES.MONTH = 30 * SCALES.DAY;
SCALES.YEAR = 365 * SCALES.DAY;

class LowCreditAlerts extends Task {
	constructor() {
		super('master');
	}

	async run(database, mailer) {
		const results = await database.query(`
			SELECT * FROM (
				SELECT
					*,
					((EXTRACT(EPOCH FROM uli.timespan) / uli.credits_used * uli.credits_left / 3600) || 'hours')::INTERVAL time_to_depletion
				FROM (
					SELECT
						users.id user_id,
						snowflake_to_timestamp(max(logs.id)) - snowflake_to_timestamp(min(logs.id)) timespan,
						SUM(logs.credits_used) credits_used,
						(users.credits + users.monthly_credits) credits_left,
						count(logs) request_count
					FROM logs INNER JOIN users ON logs.user_id = users.id
					WHERE
						logs.application_id IS NOT NULL AND
						logs.id >= $1
					GROUP BY users.id
				) uli
				WHERE timespan > '1 hour' OR credits_left <= credits_used ORDER BY time_to_depletion ASC
			) fui WHERE time_to_depletion < '3 days' ORDER BY time_to_depletion ASC
		`, [SnowflakeUtils.fromTimestamp(Date.now() - 1000 * 60 * 60 * 24 * 7)]).then(r => r.rows);

		let sentCount = 0;
		for (const result of results) {
			const {user_id, timespan, credits_used, credits_left, request_count, time_to_depletion} = result;
			/** @type {User} */
			const user = await User.find({
				id: user_id,
				permissions_value_ba: User.permissions.from(User.permissionNames, ['active'])
			});

			if (!user)
				continue;

			const alertType = [
				time_to_depletion <= 0,
				time_to_depletion <= 1000 * 60 * 60 * 6,
				time_to_depletion <= 1000 * 60 * 60 * 24,
				true
			].indexOf(true);

			if (user.credit_alert !== null && alertType >= user.credit_alert)
				continue;

			const template = ['ranOut', 'almostOut', 'lowReminder', 'low'][alertType];

			const transaction = new Transaction();

			await user.update({credit_alert: alertType}, transaction);

			try {
				await mailer.sendMail(user.email_address, `creditAlert/${template}`, {
					displayName: user.display_name,
					timespan: this.humanReadableInterval(timespan, 1),
					timeToDepletion: this.humanReadableInterval(time_to_depletion, 1),
					creditsUsed: parseInt(credits_used).toLocaleString('en-US'),
					creditsLeft: parseInt(credits_left).toLocaleString('en-US'),
					requestCount: parseInt(request_count).toLocaleString('en-US')
				});
			} catch (err) {
				Logger.error(err);
				await transaction.rollback();
				continue;
			}

			await transaction.commit();
			sentCount++;
		}

		Logger.info(`Sent credit alerts to ${sentCount} users`);
	}

	humanReadableInterval(offset, precision) {
		let negative = offset < 0;
		if (negative)
			offset = Math.abs(offset);

		let values = [];
		for (const scale of Object.values(SCALES).reverse()) {
			const scaled = ~~(offset / scale);
			values.push(scaled);
			offset -= scaled * scale;
		}

		const firstNotZero = values.findIndex(value => !!value);
		values = values.slice(firstNotZero, firstNotZero + precision);

		const suffixes = Object.keys(SCALES).reverse().slice(firstNotZero, firstNotZero + precision);
		const timeStr = values
			.map((value, index) => `${value} ${suffixes[index].toLowerCase()}${value !== 1 ? 's' : ''}`)
			.join(', ');

		return negative ? `${timeStr}` : `${timeStr}`;
	}

	get nextRun() {
		const date = new Date();
		date.setMinutes(date.getMinutes() + (10 - (date.getMinutes() % 10)), 0, 0);

		return date.valueOf();
	}
}

module.exports = new LowCreditAlerts();
