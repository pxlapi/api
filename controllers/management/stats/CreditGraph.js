const {DatabaseHandler} = require('../../../util/database/Handler');
const SnowflakeUtils = require('../../../util/Snowflake');
const Application = require('../../../models/application/Application');
const ManagementController = require('../../../util/http/controller/ManagementController');

class CreditGraph extends ManagementController {
	constructor(router) {
		super(router, '/management/stats/credit_graph/{id}');
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

		const date = new Date();
		date.setUTCDate(1);
		date.setUTCHours(0, 0, 0, 0);

		const timeWindowStartID = SnowflakeUtils.fromTimestamp(date);

		const stats = await DatabaseHandler.query(`
			SELECT
				sum(credits_used) credits_used,
				(FLOOR(EXTRACT(EPOCH FROM snowflake_to_timestamp(logs.id)) / 60 / 60 / 24) * 60 * 60 * 24) AS timestamp
			FROM logs
			WHERE
				application_id ${application ? '= $1' : 'IS NOT NULL AND user_id = $1'} AND logs.id >= $2
			GROUP BY timestamp
			ORDER BY timestamp ASC
		`, [application ? application.id : context.user.id, timeWindowStartID]);

		context.ok(stats.rows.map(({credits_used, timestamp}) => ({
			timestamp,
			credits_used: parseInt(credits_used ?? '0')
		})));
	}
}

module.exports = CreditGraph;
