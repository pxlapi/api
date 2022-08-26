const Application = require('../../../models/application/Application');
const ApplicationQuota = require('../../../models/cache/ApplicationQuota');
const UserQuota = require('../../../models/cache/UserQuota');
const ManagementController = require('../../../util/http/controller/ManagementController');

class Quota extends ManagementController {
	constructor(router) {
		super(router, '/management/stats/quota/{id}');
	}

	async get(context) {
		if (!context.user)
			return context.forbidden();

		let application;
		if (context.path.has('id')) {
			application = await Application.find({id: context.path.get('id')});
			if (!application)
				return context.notFound();
			if (!context.user.permissions.admin && application.owner_id !== context.user.id)
				return context.forbidden();
		}

		let quota = {start: context.quotaUsed.startsAt, end: context.quotaUsed.expiresAt};
		if (application)
			quota.used = (await ApplicationQuota.find(application.id))?.quotaUsed ?? 0;
		else
			quota.used = (await UserQuota.find(context.user.id))?.quotaUsed ?? 0;

		context.ok(quota);
	}
}

module.exports = Quota;
