const {Image, loadImage} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

const AVAILABLE_FILTERS = ['dog', 'dog2', 'dog3', 'pig', 'flowers', 'clown'];

class Snapchat extends ImageController {
	constructor(router) {
		super(router, '/snapchat/{filter}');
	}

	/**
	 * @api {post} /snapchat/:filter Snapchat
	 * @apiGroup Image Manipulation
	 * @apiDescription Applies a snapchat-like filter to the faces in the image.
	 * Accepts one image with at least one human face
	 *
	 * @apiParam (Path Arguments) {string="dog","dog2","dog3","pig","flowers","clown","random"} [filter="dog"] The filter to apply
	 * @apiParam (Request Parameters) {string[]} [filters] What filters to limit "random" to (defaults to all available filters)
	 *
	 * @apiUse ReturnsImage
	 * @apiUse RequiresImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const filter = context.path.get('filter') ?? 'dog';
		if (filter !== 'random' && !AVAILABLE_FILTERS.includes(filter))
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

		if (filter === 'random') {
			let filters = context.parameters.get('filters');

			if (![null, undefined].includes(filters)) {
				if (!Array.isArray(filters))
					filters = [filters];

				if (!filters.length || filters.some(filter => !AVAILABLE_FILTERS.includes(filter)))
					return context.badRequest('INVALID_FILTER_LIST');
			}

			await Snapchat.random(image, faces, filters ?? AVAILABLE_FILTERS);
		} else
			await Snapchat[filter](image, faces);

		return context.okImage(image);
	}

	static async dog(image, faces) {
		const filter = await loadImage('./assets/snapchat/dog.png');
		const earL = filter.__crop__(0, 0, 167, 141);
		const earR = filter.__crop__(167, 0, 166, 139);
		const nose = filter.__crop__(0, 141, 154, 92);
		const tongue = filter.__crop__(154, 141, 203, 205);

		for (const face of faces) {
			Snapchat.composite(image, earL, face.face_rectangle.left + face.face_rectangle.width * 0.3, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earL.width / face.face_rectangle.width, 144, 83);
			Snapchat.composite(image, earR, face.face_rectangle.left + face.face_rectangle.width * 0.7, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earR.width / face.face_rectangle.width, 22, 83);
			Snapchat.composite(image, nose, face.landmark.nose_tip.x, face.landmark.nose_tip.y, 2 * nose.width / face.face_rectangle.width, 76, 32);
			Snapchat.composite(image, tongue, face.landmark.mouth_lower_lip_top.x, face.landmark.mouth_lower_lip_top.y, 2 * tongue.width / face.face_rectangle.width, 98, 20);
		}
	}

	static async dog2(image, faces) {
		const filter = await loadImage('./assets/snapchat/dog2.png');
		const earL = filter.__crop__(0, 0, 96, 108);
		const earR = filter.__crop__(96, 0, 92, 109);
		const nose = filter.__crop__(0, 108, 88, 64);
		const tongue = filter.__crop__(88, 109, 142, 144);

		for (const face of faces) {
			Snapchat.composite(image, earL, face.face_rectangle.left + face.face_rectangle.width * 0.3, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earL.width / face.face_rectangle.width, 86, 15);
			Snapchat.composite(image, earR, face.face_rectangle.left + face.face_rectangle.width * 0.7, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earR.width / face.face_rectangle.width, 10, 15);
			Snapchat.composite(image, nose, face.landmark.nose_tip.x, face.landmark.nose_tip.y, 2 * nose.width / face.face_rectangle.width, 45, 23);
			Snapchat.composite(image, tongue, face.landmark.mouth_lower_lip_top.x, face.landmark.mouth_lower_lip_top.y, 2 * tongue.width / face.face_rectangle.width, 68, 14);
		}
	}

	static async dog3(image, faces) {
		const filter = await loadImage('./assets/snapchat/dog3.png');
		const earL = filter.__crop__(0, 0, 203, 175);
		const earR = filter.__crop__(203, 0, 200, 180);
		const nose = filter.__crop__(0, 175, 194, 113);

		for (const face of faces) {
			Snapchat.composite(image, earL, face.face_rectangle.left + face.face_rectangle.width * 0.3, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earL.width / face.face_rectangle.width, 170, 117);
			Snapchat.composite(image, earR, face.face_rectangle.left + face.face_rectangle.width * 0.7, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earR.width / face.face_rectangle.width, 28, 117);
			Snapchat.composite(image, nose, face.landmark.nose_tip.x, face.landmark.nose_tip.y, 2 * nose.width / face.face_rectangle.width, 97, 37);
		}
	}

	static async pig(image, faces) {
		const filter = await loadImage('./assets/snapchat/pig.png');
		const earL = filter.__crop__(0, 0, 105, 111);
		const earR = filter.__crop__(105, 0, 105, 111);
		const nose = filter.__crop__(0, 111, 148, 125);

		for (const face of faces) {
			Snapchat.composite(image, earL, face.face_rectangle.left + face.face_rectangle.width * 0.3, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earL.width / face.face_rectangle.width, 95, 57);
			Snapchat.composite(image, earR, face.face_rectangle.left + face.face_rectangle.width * 0.7, face.face_rectangle.top - face.face_rectangle.height * 0.2, 2 * earR.width / face.face_rectangle.width, 11, 57);
			Snapchat.composite(image, nose, face.landmark.nose_tip.x, face.landmark.nose_tip.y, 2.5 * nose.width / face.face_rectangle.width, 74, 52);
		}
	}

	static async flowers(image, faces) {
		const filter = await loadImage('./assets/snapchat/flowers.png');
		for (const face of faces)
			Snapchat.composite(image, filter, face.face_rectangle.left + face.face_rectangle.width / 2, face.face_rectangle.top, 0.75 * filter.width / face.face_rectangle.width, filter.width / 2, filter.height * 0.9);
	}

	static async clown(image, faces) {
		const filter = await loadImage('./assets/snapchat/clown.png');
		for (const face of faces)
			Snapchat.composite(image, filter, face.face_rectangle.left + face.face_rectangle.width / 2, face.face_rectangle.top, .75 * filter.width / face.face_rectangle.width, filter.width / 2, filter.height * 0.8);
	}


	static async random(image, faces, filters) {
		filters = [...filters];

		const randomizedFilters = [];
		while (filters.length) {
			const filter = filters.splice(Math.floor(Math.random() * filters.length))[0];
			randomizedFilters.push(filter);
		}

		for (const filter of randomizedFilters) {
			let count = faces.length / randomizedFilters.length;
			const randomFaces = [];
			while (count-- > 0)
				randomFaces.push(faces.splice(Math.floor(Math.random() * faces.length), 1)[0]);

			await Snapchat[filter](image, randomFaces);

			if (!faces.length)
				break;
		}
	}

	static composite(image, asset, x, y, scale, centerX, centerY) {
		x -= centerX / scale;
		y -= centerY / scale;

		const scaledAsset = asset.__scale__(1 / scale);
		image.composite(scaledAsset, x, y);
	}
}

module.exports = Snapchat;
