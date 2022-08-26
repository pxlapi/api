const fs = require('fs/promises');
const {Image, TextLayout, loadImage} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

const LAYOUT = new TextLayout({
	maxWidth: 580,
	maxHeight: 584,
	verticalAlign: 'center',
	horizontalAlign: 'middle'
});

class Sonic extends ImageController {
	constructor(router) {
		super(router, '/sonic');
	}

	/**
	 * @api {post} /sonic Sonic
	 * @apiGroup Image Manipulation
	 * @apiDescription Renders the given text on a sonic quote template
	 *
	 * @apiParam (Request Parameters) {string=1..1000} text What text to print into the speech bubble
	 *
	 * @apiUse ReturnsImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const text = context.parameters.get('text');
		if (typeof text !== 'string' || !text || text.length > 1000)
			return context.badRequest('INVALID_TEXT');

		const template = await loadImage('assets/sonic.jpg');
		const textImage = await Image.renderText(await fs.readFile('assets/fonts/impact.ttf'), 64, text, 0xffffffff, LAYOUT);
		textImage.crop(0, 0, LAYOUT.maxWidth, LAYOUT.maxHeight);

		template.composite(textImage, 378 + (LAYOUT.maxWidth - textImage.width) / 2, 103 + (LAYOUT.maxHeight - textImage.height) / 2);

		context.ok(await template.encode());
	}
}

module.exports = Sonic;
