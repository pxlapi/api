const Application = require('../../../models/application/Application');
const ManagementController = require('../../../util/http/controller/ManagementController');

/**
 * @apiDefine ApplicationResponse
 * @apiSuccess {string} id The applications unique ID
 * @apiSuccess {string} owner_id The applications owners user ID
 * @apiSuccess {string} display_name The applications display name
 * @apiSuccess {boolean} active Whether the application is active or not
 * @apiSuccess {string} token The applications API token
 * @apiSuccess {number|null} quota The applications processing time quota
 */

class ApplicationController extends ManagementController {
	constructor(router) {
		super(router, '/management/applications/{id}');
	}

	get(context) {
		if (context.path.has('id'))
			return this.__show__(context);
		return this.__index__(context);
	}

	/** @param {RequestContext} context */
	async __index__(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		const applications = await Application.list(
			(context.user.permissions.admin && context.query.get('showAll')) ? {active: true} : {
				owner_id: context.user.id,
				active: true
			}
		);

		context.ok(applications);
	}

	/**
	 * @api {get} /management/applications/:id Show Application
	 * @apiGroup ~Management
	 * @apiDescription Gets the specified applications data
	 * @apiParam (Path Arguments) {string} id Application id (or "@" for authenticated application)
	 * @apiHeader {string} Authorization Access token ("Application APPLICATION_TOKEN")
	 *
	 * @apiUse ApplicationResponse
	 * @apiUse Unauthorized
	 * @apiUse Forbidden
	 * @apiUse NotFound
	 */
	/** @param {RequestContext} context */
	async __show__(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application && ['@', context.application.id].includes(context.path.get('id')))
			return context.ok(context.application);

		/** @type {Application|null} */
		const application = await Application.find({id: context.path.get('id')});
		if (!application)
			return context.notFound();
		if (!context.user.permissions.admin && application.owner_id !== context.user.id)
			return context.forbidden();

		context.ok(application);
	}

	async post(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden();

		let {display_name, quota} = context.body;
		if (typeof quota === 'string') {
			if (!quota)
				quota = null;
			else
				quota = parseInt(quota);
		}

		const applications = await Application.list({owner_id: context.user.id, active: true});
		if (applications.length >= 32)
			return context.badRequest('Cannot create more than 32 applications');

		const applicationModel = new Application({
			owner_id: context.user.id,
			display_name,
			active: true,
			token: Application.generateToken(),
			quota,
			updated_at: new Date()
		});

		try {
			const application = await applicationModel.create();
			context.ok(application);
		} catch (err) {
			if (err instanceof Application.InvalidModelError)
				return context.badRequest(err);
			context.error(err);
		}
	}

	async patch(context) {
		const id = context.path.get('id');
		if (!id)
			return context.notFound();
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		/** @type {Application} */
		const application = await Application.find({id});
		if (!application)
			return context.notFound();
		if (application.owner_id !== context.user.id && !context.user.permissions.admin)
			return context.forbidden();

		let {display_name, token, quota} = context.body;
		if (typeof quota === 'string') {
			if (!quota)
				quota = null;
			else
				quota = parseInt(quota);
		}

		try {
			/** @type {Model} */
			const deletedApplication = await application.update({
				display_name: display_name ?? application.display_name,
				token: token ? Application.generateToken() : application.token,
				quota: quota === undefined ? application.quota : quota,
				updated_at: new Date()
			});

			context.ok(deletedApplication);
		} catch (err) {
			if (err instanceof Application.InvalidModelError)
				return context.badRequest(err);
			context.error(err);
		}
	}

	async delete(context) {
		const id = context.path.get('id');
		if (!id)
			return context.notFound();
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		/** @type {Application} */
		const application = await Application.find({id});
		if (!application)
			return context.notFound();
		if (application.owner_id !== context.user.id && !context.user.permissions.admin)
			return context.forbidden();

		/** @type {Model} */
		const result = await application.update({active: false, updated_at: new Date()});
		context.ok(result);
	}
}

module.exports = ApplicationController;
