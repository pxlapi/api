const {inspect} = require('util');
const Controller = require('../../util/http/controller/Controller');

class Eval extends Controller {
	constructor(router) {
		super(router, '/eval/');
	}

	async post(context) {
		if (!context.application)
			return context.unauthorized();
		if (!context.user.permissions.admin)
			return context.forbidden();

		let result;
		try {
			result = await Promise.resolve(eval(context.body.code));
		} catch (err) {
			result = err;
		}

		context.ok(inspect(result));
	}
}

module.exports = Eval;
