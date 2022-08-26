const {Image} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

class JPEG extends ImageController {
	constructor(router) {
		super(router, '/jpeg');
	}

	/**
	 * @api {post} /jpeg JPEG
	 * @apiGroup Image Manipulation
	 * @apiDescription Applies a low-quality JPEG effect to the given image
	 *
	 * @apiParam (Request Parameters) {number=1..100} [quality=1] What JPEG quality to encode the image as
	 *
	 * @apiUse ReturnsImage
	 * @apiUse RequiresImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		let quality = context.parameters.get('quality') ?? 1;
		if (isNaN(quality) || quality < 1 || quality > 100)
			return context.badRequest('INVALID_QUALITY');
		quality = parseInt(quality);

		let image;
		try {
			[image] = await this.loadImagesFromContext(context, 1, 1, Infinity);
		} catch (err) {
			return context.badRequest(err);
		}

		if (image instanceof Image)
			image = [image];

		for (const frame of image) {
			const jpeg = await frame.encodeJPEG(quality);
			const image = await Image.decode(jpeg);
			frame.bitmap.set(image.bitmap);
		}

		return context.okImage(image);
	}
}

module.exports = JPEG;
