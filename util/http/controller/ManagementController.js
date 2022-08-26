const Controller = require('./Controller');

class ManagementController extends Controller {
	constructor(router, ...paths) {
		for (let path of paths)
			if (!path.startsWith('/management/'))
				throw new Error('ManagementController path does not start with /management/!');

		super(router, ...paths);
	}
}

module.exports = ManagementController;
