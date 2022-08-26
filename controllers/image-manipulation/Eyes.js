const {loadImage} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

const AVAILABLE_TYPES = ['big', 'black', 'bloodshot', 'blue', 'default', 'googly', 'green', 'horror', 'illuminati', 'money', 'pink', 'red', 'small', 'spinner', 'spongebob', 'white', 'yellow'];
const SPECIAL_RESIZE = ['black', 'blue', 'green', 'pink', 'red', 'white', 'yellow'];

class Eyes extends ImageController {
	constructor(router) {
		super(router, '/eyes/{type}');
	}

	/**
	 * @api {post} /eyes/:type Eyes
	 * @apiGroup Image Manipulation
	 * @apiDescription Applies different types of eyes to the faces in the image.
	 * Accepts one image with at least one human face
	 *
	 * @apiParam (Path Arguments) {string="big","black","bloodshot","blue","default","googly","green","horror","illuminati","money","pink","red","small","spinner","spongebob","white","yellow","random"} [type="default"] The eye type to apply
	 * @apiParam (Request Parameters) {string[]} [types] What types to limit "random" to (defaults to all available filters)
	 *
	 * @apiUse ReturnsImage
	 * @apiUse RequiresImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const type = context.path.get('type') ?? 'default';
		if (type !== 'random' && !AVAILABLE_TYPES.includes(type))
			return context.badRequest('INVALID_FILTER');

		let image;
		try {
			[image] = await this.loadImagesFromContext(context, 1, 1);
		} catch (err) {
			return context.badRequest(err);
		}

		const faces = await this.detectFaces(context, image);
		if (!faces.length)
			return context.badRequest('NO_FACES_DETECTED');

		if (type === 'random') {
			let types = context.parameters.get('types');

			if (![null, undefined].includes(types)) {
				if (!Array.isArray(types))
					types = [types];

				if (!types.length || types.some(type => !AVAILABLE_TYPES.includes(type)))
					return context.badRequest('INVALID_FILTER_LIST');
			}

			await Eyes.random(image, faces, types ?? AVAILABLE_TYPES);
		} else
			await Eyes.apply(image, faces, type);

		return context.okImage(image);
	}

	static async apply(image, faces, type) {
		const overlay = await loadImage(`assets/eyes/${type}.png`);
		for (const face of faces) {
			const resizeFactor = SPECIAL_RESIZE.includes(type) ? (face.face_rectangle.width / overlay.width) * 5 : (face.face_rectangle.width / overlay.width) / 3;

			Eyes.composite(
				image, overlay,
				face.landmark.left_eye_pupil.x, face.landmark.left_eye_pupil.y,
				resizeFactor
			);

			Eyes.composite(image, overlay,
				face.landmark.right_eye_pupil.x, face.landmark.right_eye_pupil.y,
				resizeFactor
			);
		}
	}

	static async random(image, faces, types) {
		types = [...types];

		const randomizedTypes = [];
		while (types.length) {
			const filter = types.splice(Math.floor(Math.random() * types.length))[0];
			randomizedTypes.push(filter);
		}

		for (const type of randomizedTypes) {
			let count = faces.length / randomizedTypes.length;
			const randomFaces = [];
			while (count-- > 0)
				randomFaces.push(faces.splice(Math.floor(Math.random() * faces.length), 1)[0]);

			await Eyes.apply(image, randomFaces, type);

			if (!faces.length)
				break;
		}
	}

	static composite(image, asset, x, y, scale, centerX, centerY) {
		if (!centerX)
			centerX = asset.width / 2;
		if (!centerY)
			centerY = asset.height / 2;

		x -= centerX * scale;
		y -= centerY * scale;

		const scaledAsset = asset.__scale__(scale);
		image.composite(scaledAsset, x, y);
	}
}

module.exports = Eyes;
