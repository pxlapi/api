const {Image, loadImage} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

class Lego extends ImageController {
	constructor(router) {
		super(router, '/lego');
	}

	/**
	 * @api {post} /lego Lego
	 * @apiGroup Image Manipulation
	 * @apiDescription Turns the given image into a plane of LEGO 1x1 pieces
	 *
	 * @apiParam (Request Parameters) {number=6..} [groupSize] How big of a pixel square to group into one brick. Defaults to a 32x32 brick result
	 * @apiParam (Request Parameters) {boolean} [scale=false] Whether to resize the resulting image to the original images dimensions
	 *
	 * @apiUse ReturnsImage
	 * @apiUse RequiresImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		let groupSize = context.parameters.get('groupSize');
		if (groupSize !== undefined && groupSize < 6)
			return context.badRequest('INVALID_GROUP_SIZE');

		const scale = ['1', 1, 'true', true, ''].includes(context.parameters.get('scale'));

		let image;
		try {
			[image] = await this.loadImagesFromContext(context, 1, 1);
		} catch (err) {
			return context.badRequest(err);
		}

		if (!groupSize)
			groupSize = Math.ceil(Math.max(image.width, image.height) / 32);

		groupSize = Math.min(groupSize, Math.max(image.width, image.height));

		const result = await Lego.lego(image, groupSize, scale);
		return context.okImage(result);
	}

	/**
	 * @param {Image} image
	 * @param {number} groupSize
	 * @param {boolean} scaleToOriginalDimensions
	 * @returns {Promise<Image>}
	 */
	static async lego(image, groupSize, scaleToOriginalDimensions) {
		image.resize(image.width / groupSize, image.height / groupSize);

		/** @type {Image} */
		let sprite = await loadImage('./assets/lego.png');

		const div = 1 / 0xff;
		const result = new Image(image.width * sprite.width, image.height * sprite.height);
		for (const [x, y, color] of image.iterateWithColors()) {
			const a = color & 0xff;
			const b = (color >> 8) & 0xff;
			const r = (color >> 24) & 0xff;
			const g = (color >> 16) & 0xff;
			const spriteClone = sprite.clone();

			// TODO(evan): replace with one loop
			spriteClone.red(r * div);
			spriteClone.blue(b * div);
			spriteClone.green(g * div);
			spriteClone.opacity(a * div);

			result.composite(spriteClone, (x - 1) * sprite.width, (y - 1) * sprite.height);
		}

		if (scaleToOriginalDimensions)
			result.resize(image.width * groupSize, image.height * groupSize);

		return result;
	}
}

module.exports = Lego;
