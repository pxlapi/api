const {Image, Frame, GIF} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

class Glitch extends ImageController {
	constructor(router) {
		super(router, '/glitch');
	}

	/**
	 * @api {post} /glitch Glitch
	 * @apiGroup Image Manipulation
	 * @apiDescription Applies a glitch effect to the given image
	 *
	 * @apiParam (Request Parameters) {number=1..100} [iterations=10] How many byte chunks to modify
	 * @apiParam (Request Parameters) {number=1..100} [amount=5] Byte chunk length
	 * @apiParam (Request Parameters) {boolean|object} [gif] Additional information for glitching static images into a GIF
	 * @apiParam (Request Parameters) {number=1..30} [gif.count=10] How many frames to generate
	 * @apiParam (Request Parameters) {number=10..1000} [gif.delay=100] How long to display each frame for (in ms)
	 *
	 * @apiUse ReturnsImage
	 * @apiUse RequiresImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const iterations = context.parameters.get('iterations') ?? 10;
		if (iterations < 1 || iterations > 100)
			return context.badRequest('INVALID_ITERATIONS');
		const amount = context.parameters.get('amount') ?? 5;
		if (amount < 1 || amount > 100)
			return context.badRequest('INVALID_AMOUNT');

		let frameCount, delay;
		if (typeof (context.body.gif ?? false) === 'object') {
			frameCount = context.body.gif.count ?? 10;
			if (frameCount < 1 || frameCount > 30)
				return context.badRequest('INVALID_COUNT');

			delay = context.body.gif.delay ?? 100;
			if (delay < 10 || delay > 1000)
				return context.badRequest('INVALID_DELAY');
		} else if (['1', 'true', true].includes(context.parameters.get('gif'))) {
			frameCount = 10;
			delay = 100;
		}

		let image;
		try {
			[image] = await this.loadImagesFromContext(context, 1, 1, Infinity);
		} catch (err) {
			return context.badRequest(err);
		}

		if (image instanceof Image) {
			if (frameCount > 1)
				image = new GIF(Array(frameCount).fill(undefined).map(() => Frame.from(image.clone(), delay)));
			else
				image = [image];
		}

		for (const frame of (image.length > 1 ? image.slice(1, Infinity) : image)) {
			const jpeg = await frame.encodeJPEG();

			Glitch.manipulateBuffer(jpeg, iterations, amount);

			try {
				const image = await Image.decode(jpeg);
				frame.bitmap.set(image.bitmap);
			} catch {
				// we don't really care about failed frames
			}
		}

		return context.okImage(image);
	}

	static manipulateBuffer(buffer, iterations, amount) {
		let headerLength;

		let pos = -1;
		while (pos < buffer.length && (pos = buffer.indexOf(0xda, pos + 1)) >= 0) {
			if (buffer[pos - 1] === 0xff) {
				headerLength = pos;
				break;
			}
		}

		if (!headerLength)
			headerLength = 1000;

		for (let i = 0; i < iterations; i++) {
			const offset = Math.ceil(Math.random() * (buffer.length - headerLength - 3)) + headerLength - 3;

			for (let a = 0; a < amount; a++)
				buffer[offset + a] = Math.floor(Math.random() * 0xff);
		}
	}
}

module.exports = Glitch;
