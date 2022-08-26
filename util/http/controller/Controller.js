// noinspection JSUnusedGlobalSymbols,JSUnusedGlobalSymbols,JSUnusedGlobalSymbols
class Controller {
	/**
	 * @param {Router} router
	 * @param {string} paths
	 */
	constructor(router, ...paths) {
		router.route(this, paths);
	}

	/** @param {RequestContext} context */
	async get(context) {
		context.notAllowed();
	}

	/** @param {RequestContext} context */
	async post(context) {
		context.notAllowed();
	}

	/** @param {RequestContext} context */
	async put(context) {
		context.notAllowed();
	}

	/** @param {RequestContext} context */
	async patch(context) {
		context.notAllowed();
	}

	/** @param {RequestContext} context */
	async delete(context) {
		context.notAllowed();
	}

	/** @param {RequestContext} context */
	async options(context) {
		context.ok();
	}
}

module.exports = Controller;
