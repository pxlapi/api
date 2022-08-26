const {Image, loadImage} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');
const {emojiSize, averages} = require('../../assets/emojimosaic/meta.json');

class EmojiMosaic extends ImageController {
	constructor(router) {
		super(router, '/emojimosaic');
	}

	/**
	 * @api {post} /emojimosaic Emoji Mosaic
	 * @apiGroup Image Manipulation
	 * @apiDescription Turns the given image into a mosaic of emojis.
	 * First image will be the image recreated, all following images will be used as custom emojis
	 *
	 * @apiParam (Request Parameters) {number=6..} [groupSize] How big of a pixel square to group into one emoji. Defaults to a 32x32 emoji result
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

		let image, customEmojiImages;
		try {
			[image, ...customEmojiImages] = await this.loadImagesFromContext(context, Infinity, 1);
		} catch (err) {
			return context.badRequest(err);
		}

		if (!groupSize)
			groupSize = Math.ceil(Math.max(image.width, image.height) / 32);

		groupSize = Math.min(groupSize, Math.max(image.width, image.height));

		const result = await EmojiMosaic.emojify(image, groupSize, customEmojiImages, scale);
		return context.okImage(result);
	}

	/**
	 * @param {Image} image
	 * @param {number} groupSize
	 * @param {Image[]} customEmojiImages
	 * @param {boolean} scaleToOriginalDimensions
	 * @returns {Promise<Image>}
	 */
	static async emojify(image, groupSize, customEmojiImages = [], scaleToOriginalDimensions) {
		image.resize(image.width / groupSize, image.height / groupSize);

		/** @type {{averages: number[], image: Image}[]} */
		const customEmojis = [];
		for (const customEmoji of customEmojiImages) {
			let r = 0;
			let g = 0;
			let b = 0;
			let a = 0;

			for (const [, , color] of customEmoji.iterateWithColors()) {
				a += color & 0xff;
				b += (color >> 8) & 0xff;
				r += (color >> 24) & 0xff;
				g += (color >> 16) & 0xff;
			}

			const cwh = customEmoji.width * customEmoji.height;

			r /= cwh;
			g /= cwh;
			b /= cwh;
			a /= cwh;

			customEmojis.push({averages: [r, g, b, a], image: customEmoji});
		}

		/** @type {Image} */
		let sprite = await loadImage('./assets/emojimosaic/sprite.png');
		const EMOJIS_PER_ROW = sprite.width / emojiSize;
		const colorCache = {};
		const spriteCache = {};

		let result = new Image(image.width * emojiSize, image.height * emojiSize);

		for (const [x, y, color] of image.iterateWithColors()) {
			if (!colorCache[color]) {
				const a = color & 0xff;
				const b = (color >> 8) & 0xff;
				const r = (color >> 24) & 0xff;
				const g = (color >> 16) & 0xff;

				if (a === 0) {
					colorCache[color] = -1;
					continue;
				}

				colorCache[color] = this.findSprite(r, g, b, a, customEmojis);
			}

			const spriteIdx = colorCache[color];
			if (spriteIdx === -1)
				continue;

			if (!spriteCache[spriteIdx]) {
				if (spriteIdx >= averages.length) {
					spriteCache[spriteIdx] = customEmojis[spriteIdx - averages.length].image.resize(emojiSize, emojiSize);
				} else {
					const spriteStartX = (spriteIdx % EMOJIS_PER_ROW) * emojiSize;
					const spriteStartY = Math.floor(spriteIdx / EMOJIS_PER_ROW) * emojiSize;

					spriteCache[spriteIdx] = sprite.__crop__(spriteStartX, spriteStartY, emojiSize, emojiSize);
				}
			}

			result.composite(spriteCache[spriteIdx], (x - 1) * emojiSize, (y - 1) * emojiSize);
		}

		if (scaleToOriginalDimensions)
			result.resize(result.width * groupSize / emojiSize, result.height * groupSize / emojiSize);

		return result;
	}

	static findSprite(tr, tg, tb, ta, customEmojis) {
		let offset = 0;
		let min = Infinity;

		averages.forEach((avg, i) => {
			const distance = this.distance(tr, tg, tb, ta, avg[0], avg[1], avg[2], avg[3]);

			if (min > distance) {
				offset = i;
				min = distance;
			}
		});

		if (customEmojis) customEmojis.forEach(({ averages: avg }, i) => {
			const distance = this.distance(tr, tg, tb, ta, avg[0], avg[1], avg[2], avg[3]);

			if (min > distance) {
				min = distance;
				offset = i + averages.length;
			}
		})
		
		return offset;
	}

	static distance(tr, tg, tb, ta, r, g, b, a) {
		return (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2 + (a - ta) ** 2;
	}
}

module.exports = EmojiMosaic;
