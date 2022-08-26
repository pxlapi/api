const {DatabaseHandler} = require('../../../util/database/Handler');
const Application = require('../../../models/application/Application');
const ManagementController = require('../../../util/http/controller/ManagementController');

class TopControllers extends ManagementController {
	constructor(router) {
		super(router, '/management/stats/top_controllers/{id}');
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
				controller,
				count(*)
			FROM logs
			WHERE
				application_id ${application ? '= $1' : 'IS NOT NULL AND user_id = $1'}
			GROUP BY controller
			ORDER BY count DESC
			LIMIT 10
		`, [application ? application.id : context.user.id]);

		context.ok(stats.rows.map(({controller, count}) => ({controller, count: parseInt(count)})));
	}
}

module.exports = TopControllers;
