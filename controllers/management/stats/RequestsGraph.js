const {DatabaseHandler} = require('../../../util/database/Handler');
const SnowflakeUtils = require('../../../util/Snowflake');
const Application = require('../../../models/application/Application');
const ManagementController = require('../../../util/http/controller/ManagementController');

class RequestsGraph extends ManagementController {
	constructor(router) {
		super(router, '/management/stats/requests_graph/{id}');
	}

	async get(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		let application;
		if (context.path.has('id')) {
			application = await Application.find({id: context.path.get('id')});
			if (!application)
				return context.notFound();
			if (!context.user.permissions.admin && application.owner_id !== context.user.id)
				return context.forbidden();
		}

		const timeType = context.parameters.get('type') === 'week' ? 7 : 1;
		const date = new Date();
		date.setDate(date.getDate() - timeType + 1);
		date.setHours(0, 0, 0, 0);

		const timeWindowStartID = SnowflakeUtils.fromTimestamp(date);

		const stats = await DatabaseHandler.query(`
			SELECT
				count(*),
				sum(credits_used) credits_used,
				(FLOOR(EXTRACT(EPOCH FROM snowflake_to_timestamp(logs.id)) / 60 / 60) * 60 * 60) AS timestamp
			FROM logs
			WHERE
				application_id ${application ? '= $1' : 'IS NOT NULL AND user_id = $1'} AND logs.id >= $2
			GROUP BY timestamp
			ORDER BY timestamp ASC
		`, [application ? application.id : context.user.id, timeWindowStartID]);

		context.ok(stats.rows.map(({count, credits_used, timestamp}) => ({
			timestamp,
			count: parseInt(count),
			credits_used: parseInt(credits_used)
		})));
	}
}

module.exports = RequestsGraph;
