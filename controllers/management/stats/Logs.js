const Application = require('../../../models/application/Application');
const LogEntry = require('../../../models/log/Entry');
const ManagementController = require('../../../util/http/controller/ManagementController');

class Logs extends ManagementController {
	constructor(router) {
		super(router, '/management/stats/logs/{id}');
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

		const filter = application ? {application_id: application.id} : {
			application_id_nn: true,
			user_id: context.user.id
		};

		const logs = await LogEntry.list(filter, null, {
			order: {id: 'DESC'},
			limit: 10
		});

		context.ok(logs.toAPIResponse(['remote_addresses', 'user_agent']));
	}
}

module.exports = Logs;
