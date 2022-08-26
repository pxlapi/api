const fs = require('fs/promises');
const {Image, loadImage} = require('../../util/ImageScript/ImageScript');
const Controller = require('../../util/http/controller/Controller');

const spaceWidth = 196;
const jOffset = 128;
const replacements = [
	{pattern: /\s/g, replacement: ' '},
	{pattern: /discord/gi, replacement: String.fromCharCode(2)},
	{pattern: /notso(bot)?/gi, replacement: String.fromCharCode(3)},
	{pattern: /\u200b/g, replacement: ''},
	{pattern: /[\uFE01-\uFE0F]/g, replacement: ''}
];

class Thonkify extends Controller {
	constructor(router) {
		super(router, '/thonkify');
	}

	/**
	 * @api {post} /thonkify Thonkify
	 * @apiGroup Image Manipulation
	 * @apiDescription Renders the given text in a thinking font
	 *
	 * @apiParam (Request Parameters) {string{1..70}} text The text to render
	 *
	 * @apiUse ReturnsImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		let text = context.parameters.get('text');
		if (typeof text !== 'string' || !text.length || text.length > 70)
			return context.badRequest('INVALID_TEXT');

		for (const {pattern, replacement} of replacements)
			text = text.replace(pattern, replacement);

		const charCodes = [...text].map(surrogate => surrogate.split('').map(char => char.charCodeAt(0)).join('-'));

		const availableSurrogates = await fs.readdir('./assets/thinkfont/')
			.then(fileNames => fileNames.map(fileName => fileName.split('.')[0]));

		const charImages = {};

		let width = 0;
		for (const code of charCodes) {
			if (code === '32') {
				width += spaceWidth;
				continue;
			}

			if (!availableSurrogates.includes(code))
				continue;

			if (code === '106' && width > jOffset)
				width -= jOffset;

			if (!charImages[code])
				charImages[code] = await loadImage(`./assets/thinkfont/${code}.png`);
			width += charImages[code].width + 16;
		}
		width -= 16;

		if (width <= 0)
			return context.badRequest('INVALID_TEXT');

		const canvas = new Image(width, 896);

		let xPos = 0;
		for (const code of charCodes) {
			if (code === '32') {
				xPos += spaceWidth;
				continue;
			}

			if (code === '106' && width > jOffset)
				xPos -= jOffset;

			if (!availableSurrogates.includes(code))
				continue;

			canvas.composite(charImages[code], xPos, 0);
			xPos += charImages[code].width + 16;
		}

		await canvas.resize(Image.RESIZE_AUTO, 448);
		return context.okImage(canvas);
	}
}

module.exports = Thonkify;
