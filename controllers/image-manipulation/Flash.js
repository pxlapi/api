const {Image, Frame, GIF} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

class Flash extends ImageController {
	constructor(router) {
		super(router, '/flash');
	}

	/**
	 * @api {post} /flash Flash
	 * @apiGroup Image Manipulation
	 * @apiDescription Creates a flashy GIF from the given image (inverts every other frame)
	 *
	 * @apiParam {number=20..100} [delay=40] The delay to apply between frames (when generating a GIF from a static image)
	 *
	 * @apiUse ReturnsImage
	 * @apiUse RequiresImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const delay = parseInt(context.parameters.get('delay') ?? 20);
		if (isNaN(delay) || delay < 20 || delay > 100)
			return context.badRequest('INVALID_DELAY');

		let image;
		try {
			[image] = await this.loadImagesFromContext(context, 1, 1, Infinity);
		} catch (err) {
			return context.badRequest(err);
		}

		if (image instanceof Image)
			image = new GIF([Frame.from(image, delay), Frame.from(image.clone(), delay)]);

		for (let i = 1; i < image.length; i += 2)
			image[i].invert();

		return context.okImage(image);
	}
}

module.exports = Flash;
