const crypto = require('crypto');
const FormData = require('form-data');
const Controller = require('./Controller');
const fetch = require('../../fetch/Fetch');
const {Image, GIF, decode} = require('../../ImageScript/ImageScript');
const {MAX_IMAGE_FETCH_SIZE, MAX_IMAGE_FETCH_TIMEOUT} = require('../../Constants');
const FaceDetectionCacheEntry = require('../../../models/FaceDetection');
const ConfigManager = require('../../config/Manager');

class ImageController extends Controller {
	/**
	 * @param {RequestContext} context
	 * @param {number} [limit=Infinity]
	 * @param {number} [minCount=0]
	 * @param {number} [frameLimit=Infinity]
	 * @returns {Promise<(Image|GIF)[]>}
	 */
	async loadImagesFromContext(context, limit = Infinity, minCount = 0, frameLimit = 1) {
		if (context.parameters.has('frameLimit')) {
			const frameLimitParam = context.parameters.get('frameLimit');
			if (!['number', 'string'].includes(typeof frameLimitParam) || isNaN(frameLimitParam) || frameLimit < 1)
				throw new Error('INVALID_FRAME_LIMIT');

			frameLimit = Math.min(frameLimit, parseInt(frameLimitParam));
		}

		const maxSize = Math.max(64, Math.min(1024, context.parameters.get('maxSize') ?? 1024));
		if (isNaN(maxSize))
			throw new Error('INVALID_MAX_SIZE');

		let images = [];
		try {
			if (Buffer.isBuffer(context.body) && context.body.length)
				images.push(await this.decode(context.body, frameLimit));
		} catch (err) {
			throw new Error('Request body is not a valid image (did you forget to set a Content-Type header?)');
		}

		let imageURLs = context.parameters.get('images') ?? [];
		if (typeof imageURLs === 'string')
			imageURLs = [imageURLs];

		context.creditsUsed += Math.min(imageURLs.length, limit - images.length) * 10;
		const urlFetchingStartedAt = Date.now();
		if (Array.isArray(imageURLs)) {
			try {
				const buffers = await this.loadBuffersFromURLs(imageURLs, limit - images.length);
				const decodeStart = Date.now();
				const promises = buffers.map(buffer => this.decode(buffer, frameLimit));
				images.push(...await Promise.all(promises));
				context.creditsUsed += (Date.now() - decodeStart) / 10;
			} finally {
				context.creditsUsed -= (Date.now() - urlFetchingStartedAt) / 10;
			}
		}

		if (images.length < minCount)
			throw new Error(`Not enough images supplied (${minCount} images required, ${images.length} valid images supplied)`);

		const resizeStart = Date.now();
		for (const image of images) {
			if (image.width > maxSize)
				image.resize(maxSize, Image.RESIZE_AUTO);
			if (image.height > maxSize)
				image.resize(Image.RESIZE_AUTO, maxSize);
		}

		context.creditsUsed += (Date.now() - resizeStart) / 10;

		return images;
	}

	async decode(buffer, frameLimit) {
		const result = await decode(buffer, frameLimit === 1);

		if (result instanceof GIF) {
			if (result.length === 1)
				return result[0];

			if (frameLimit < Infinity) {
				const frames = [];

				const lengthPerFrame = result.duration / frameLimit;
				let frameLength = result[0].duration;
				for (let i = 0; i < result.length; i++) {
					frameLength += result[i].duration;
					if (frameLength > lengthPerFrame) {
						result[i].duration += frameLength;
						frames.push(result[i]);
						frameLength -= lengthPerFrame;
					}

					delete result[i];
				}

				return new GIF(frames, result.loopCount);
			}
		}

		return result;
	}

	async loadBuffersFromURLs(urls = [], limit = Infinity) {
		const promises = [];
		for (let i = 0; i < Math.min(urls.length, limit); i++) {
			const url = urls[i];
			const firstURLIndex = urls.indexOf(url);
			if (firstURLIndex !== i) {
				promises.push(promises[firstURLIndex]);
				continue;
			}

			promises.push(this.loadBufferFromURL(url));
		}

		return await Promise.all(promises);
	}

	async loadBufferFromURL(url) {
		const response = await fetch(url, {size: MAX_IMAGE_FETCH_SIZE, timeout: MAX_IMAGE_FETCH_TIMEOUT});
		if (!response.ok)
			throw new Error((await response.text()) || `Failed to download image: ${response.status} ${response.statusText}`);
		return await response.buffer();
	}

	/**
	 * @param {RequestContext} context
	 * @param {Image} image
	 * @returns {Promise<Face[]>}
	 */
	async detectFaces(context, image) {
		const hash = crypto
			.createHash('md5')
			.update(image.bitmap)
			.digest('hex');

		/** @type {FaceDetectionCacheEntry} */
		const cachedResult = await FaceDetectionCacheEntry.find({hash});
		if (cachedResult)
			return cachedResult.faces;

		if (image.width < 48)
			image.resize(48, Image.RESIZE_AUTO);
		if (image.height < 48)
			image.resize(Image.RESIZE_AUTO, 48);

		/** @type {Uint8Array} */
		const imageBuffer = await image.encodeJPEG();

		const {faceDetection: {key, secret, url}} = ConfigManager.current;

		const body = new FormData();
		body.append('api_key', key);
		body.append('api_secret', secret);
		body.append('image_file', Buffer.from(imageBuffer), 'image.jpg');
		body.append('return_landmark', 1);
		body.append('return_attributes', 'headpose');

		const fetchStart = Date.now();
		const response = await fetch(url, {method: 'POST', body});
		context.creditsUsed += 50;
		context.creditsUsed -= (Date.now() - fetchStart) / 10;
		if (!response.ok)
			return [];

		/**
		 * @typedef {{
		 * 		face_rectangle: {
		 *			top: number,
		 *			left: number,
		 *			width: number,
		 *			height: number
		 * 		},
		 * 		landmark: Object<string, {x: number, y: number}>,
		 * 		attributes: {
		 *			headpose: {
		 *			 	pitch_angle: number,
		 *			 	roll_angle: number,
		 *			 	yaw_angle: number
		 *			}
		 * 		} | undefined
		 * 	}} Face
		 */

		/** @type {{time_used: number, faces: Face[]}} */
		const result = await response.json();

		for (const face of result.faces)
			delete face.face_token;

		const cacheEntry = new FaceDetectionCacheEntry({
			hash,
			time_taken: `${result.time_used}ms`,
			faces: result.faces
		});

		void cacheEntry.create();

		return result.faces;
	}
}

module.exports = ImageController;
