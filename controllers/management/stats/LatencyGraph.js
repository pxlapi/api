const {DatabaseHandler} = require('../../../util/database/Handler');
const SnowflakeUtils = require('../../../util/Snowflake');
const ManagementController = require('../../../util/http/controller/ManagementController');

class LatencyGraph extends ManagementController {
	constructor(router) {
		super(router, '/management/stats/latency_graph');
	}

	async get(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');
		if (!context.user.permissions.admin)
			return context.forbidden();

		const timeWindowStartID = SnowflakeUtils.fromTimestamp(new Date().setHours(0, 0, 0, 0));
		const stats = await DatabaseHandler.query(`
			SELECT
				time_taken,
				(FLOOR(EXTRACT(EPOCH FROM snowflake_to_timestamp(logs.id)) / 60) * 60) AS timestamp
			FROM logs
			WHERE application_id IS NOT NULL AND id >= $1
			ORDER BY timestamp ASC
		`, [timeWindowStartID]);

		const latencyObj = {};
		for (const {timestamp, time_taken} of stats.rows) {
			if (!latencyObj[timestamp])
				latencyObj[timestamp] = [];
			latencyObj[timestamp].push(time_taken);
		}

		context.ok(latencyObj);
	}
}

module.exports = LatencyGraph;
