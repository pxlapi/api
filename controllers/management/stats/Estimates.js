const SnowflakeUtils = require('../../../util/Snowflake');
const LogEntry = require('../../../models/log/Entry');
const ManagementController = require('../../../util/http/controller/ManagementController');
const {DatabaseHandler} = require('../../../util/database/Handler');

class Estimates extends ManagementController {
	constructor(router) {
		super(router, '/management/estimates');
	}

	async get(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		const mostRecentLogs = await LogEntry.list({
			user_id: context.user.id,
			application_id_nn: true
		}, null, {
			order: {id: 'DESC'},
			limit: 2
		});

		if (mostRecentLogs.length < 2)
			return context.badRequest('Not enough requests have been sent to calculate an estimate');

		const startTimestamp = Math.min(Date.now() - 1000 * 60 * 60 * 24 * 7, SnowflakeUtils.toDate(mostRecentLogs[1].id, true));

		const {
			rows: [{
				timespan,
				credits_used,
				credits_left,
				request_count,
				time_to_depletion
			}]
		} = await DatabaseHandler.query(`
			SELECT
				*,
				((EXTRACT(EPOCH FROM uli.timespan) / uli.credits_used * uli.credits_left) || 'seconds')::INTERVAL time_to_depletion
			FROM (
				SELECT
					snowflake_to_timestamp(max(logs.id)) - snowflake_to_timestamp(min(logs.id)) timespan,
					SUM(logs.credits_used) credits_used,
					(users.credits + users.monthly_credits) credits_left,
					count(logs) request_count
				FROM logs INNER JOIN users ON logs.user_id = users.id
				WHERE
					users.id = $1 AND
					logs.application_id IS NOT NULL AND
					logs.id >= $2
				GROUP BY users.id
			) uli
		`, [context.user.id, SnowflakeUtils.fromTimestamp(startTimestamp)]);

		context.ok({
			timespan,
			credits_used: parseInt(credits_used),
			credits_left,
			request_count: parseInt(request_count),
			time_to_depletion
		});
	}
}

module.exports = Estimates;
