const {DatabaseHandler} = require('../../../util/database/Handler');
const SnowflakeUtils = require('../../../util/Snowflake');
const Application = require('../../../models/application/Application');
const ManagementController = require('../../../util/http/controller/ManagementController');

class ApplicationStats extends ManagementController {
	constructor(router) {
		super(router, '/management/stats/applications/{id}');
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

		const stats = await DatabaseHandler.query(`
			SELECT
				application_id,
				count(*),
				sum(credits_used) credits_used
			FROM logs
			WHERE
				application_id ${application ? '= $1' : 'IS NOT NULL AND user_id = $1'} AND logs.id >= $2
			GROUP BY application_id
		`, [
			application ? application.id : context.user.id,
			SnowflakeUtils.fromTimestamp(Date.now() - 1000 * 60 * 60 * 24)
		]);

		const statsObj = {};
		if (application) {
			statsObj.count = parseInt(stats.rows[0]?.count ?? 0);
			statsObj.credits_used = parseInt(stats.rows[0]?.credits_used ?? 0);
		} else
			for (const {application_id, count, credits_used} of stats.rows)
				statsObj[application_id] = {count: parseInt(count), credits_used: parseInt(credits_used)};

		context.ok(statsObj);
	}
}

module.exports = ApplicationStats;
