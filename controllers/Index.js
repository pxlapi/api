const Controller = require('../util/http/controller/Controller');

/**
 * @apiDefine BadRequest
 * @apiError 400 The supplied data was invalid (see response text for more info)
 */

/**
 * @apiDefine Unauthorized
 * @apiHeader {string} Authorization Application access token (`Application APPLICATION_TOKEN`)
 * @apiError 401 No valid Authorization header was supplied
 */

/**
 * @apiDefine Forbidden
 * @apiError 403 The supplied authorization has no access to this resource
 */

/**
 * @apiDefine NotFound
 * @apiError 404 The given resource could not be found
 */

/**
 * @apiDefine ReturnsImage
 * @apiSuccess {binary} null The processed image data
 */

/**
 * @apiDefine RequiresImage
 * @apiParam (Request Parameters) {string[]} images The image URL(s) to process
 */

class IndexController extends Controller {
	constructor(router) {
		super(router, '/');
	}

	async get(context) {
		context.ok('pxlAPI');
	}
}

module.exports = IndexController;
