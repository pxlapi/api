const fs = require('fs/promises');
const http = require('http');
const {Isolate} = require('isolated-vm');
const ImageController = require('../../util/http/controller/ImageController');
const fetch = require('../../util/fetch/Fetch');
const ImageScriptResource = require('../../models/cache/ImageScriptResource');

const VERSION_HASHES = {
	'1.2.0': '77098f938d7b5aa62c43f76d5f291ac2f79c724b',
	'1.2.3': '221096bad76d32b1d50318bd57d9f2c5f5b10616',
	'1.2.5': '35cf299e14530360d8e03658794c3758f3634933',
	'1.2.6': '677b3384efc796f6ab44304a6b953e4896a40407',
	'1.2.9': '6635b408e83ada17738356eb5f5f8c55950a3cc4'
};

class ImageScript extends ImageController {
	constructor(router) {
		super(router, '/imagescript/{version}');
	}

	/**
	 * @api {get} /imagescript/versions ImageScript versions
	 * @apiGroup Image Manipulation
	 * @apiDescription Lists the available [ImageScript versions](https://github.com/matmen/ImageScript/releases) pxlAPI supports
	 */
	async get(context) {
		if (context.path.get('version') !== 'versions')
			return context.notFound();
		context.ok(Object.keys(VERSION_HASHES));
	}

	/**
	 * @api {post} /imagescript/:version ImageScript
	 * @apiGroup Image Manipulation
	 * @apiDescription Runs [ImageScript](https://github.com/matmen/ImageScript) code as a service.<br><br>
	 * Exposes a polyfill `fetch(url, init)` function which supports the following `init` parameters: `method`, `headers`, `body`.<br>
	 * Returns a polyfill Response object with the following properties: `headers`, `redirected`, `status`, `statusText`, `ok`, `url`, `arrayBuffer()`, `text()`, `json()`.<br>
	 * Limited to 20 fetch calls per script evaluation.
	 *
	 * @apiParam (Path Arguments) {string} [version="latest"] The [ImageScript version](https://github.com/matmen/ImageScript/releases) to use
	 *
	 * @apiParam (Request Parameters) {string} code The code to evaluate
	 * @apiParam (Request Parameters) {object} [inject] The data to inject as global variables
	 * @apiParam (Request Parameters) {number=1000..20000} [timeout=10000] Maximum run time in ms
	 *
	 * @apiUse ReturnsImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const code = context.parameters.get('code');
		if (!code || typeof code !== 'string')
			return context.badRequest('INVALID_CODE');

		const inject = context.parameters.get('inject');
		if (!['undefined', 'object'].includes(typeof inject))
			return context.badRequest('INVALID_INJECT');

		const timeout = parseInt(context.parameters.get('timeout') ?? 10000);
		if (isNaN(timeout) || timeout < 1000 || timeout > 20000)
			return context.badRequest('INVALID_TIMEOUT');

		let version = context.path.get('version') ?? 'latest';

		if (version === 'latest') {
			const versions = Object.keys(VERSION_HASHES);
			version = versions[versions.length - 1];
		}

		if (!Object.keys(VERSION_HASHES).includes(version))
			return context.badRequest('UNSUPPORTED_VERSION');

		const fetchController = new FetchHandler();

		const ISBundle = fetchController.fetch(`https://raw.githubusercontent.com/matmen/ImageScript/${VERSION_HASHES[version]}/browser/ImageScript.js`)
			.then(r => new TextDecoder().decode(r.arrayBuffer));
		const polyfills = fs.readFile('./util/ImageScript/aaS/Polyfills.js').then(r => r.toString());

		const isolate = new Isolate({memoryLimit: 256});
		const isolateContext = await isolate.createContext();

		const injectPromises = [];
		if (inject)
			for (const [key, value] of Object.entries(inject))
				injectPromises.push(isolateContext.global.set(key, value, {copy: true}));

		await isolateContext.evalClosure(
			`
			fetch = async function fetch(url, args) {
				const result = await $0.apply(undefined, [url, args], {arguments: {copy: true}, result: {copy: true, promise: true}});
				if(result.error) {
					delete result.error;
					throw Object.assign(new Error(), result);
				}

				return {
					headers: result.headers,
					redirected: result.redirected,
					status: result.status,
					statusText: result.statusText,
					ok: result.ok,
					url: result.url,
					
					arrayBuffer() { return result.arrayBuffer },
					text() { return new TextDecoder().decode(new Uint8Array(this.arrayBuffer())) },
					json() { return JSON.parse(this.text()) }
				};
			}
			${await polyfills}
			${await ISBundle}
			for(const name in ImageScript)
				globalThis[name] = ImageScript[name]`,
			[fetchController.fetch.bind(fetchController)],
			{
				arguments: {reference: true},
				filename: 'lib.js'
			}
		);

		await Promise.all(injectPromises);

		try {
			setTimeout(() => {
				if (!isolate.isDisposed)
					isolate.dispose();
			}, timeout + 5000);

			let result = await isolateContext.eval(`(async()=>{\n${code}\n})()`, {
				timeout,
				filename: 'UserScript.js',
				lineOffset: -1,
				copy: true,
				promise: true
			});

			if (!result)
				throw 'No data returned (did you forget to return the encoded image?)';
			if (result instanceof ArrayBuffer)
				result = new Uint8Array(result);
			if (!(result instanceof Uint8Array))
				throw 'Invalid data returned (did you forget to encode the image?)';

			const cpuTime = Number(isolate.cpuTime / 1000000n);
			const wallTime = Number(isolate.wallTime / 1000000n);
			const heapStats = await isolate.getHeapStatistics();
			context.response.setHeader('X-CPU-Time', cpuTime);
			context.response.setHeader('X-Wall-Time', wallTime);
			context.response.setHeader('X-Memory', heapStats.used_heap_size / 1000 ** 2);

			context.ok(result);
		} catch (err) {
			let stack = err?.stack ?? err?.message ?? err;
			if (typeof stack === 'string' && stack.includes('at (<isolated-vm boundary>)'))
				stack = stack.split('at (<isolated-vm boundary>)')[0]?.trim();

			context.badRequest(stack ?? 'Failed to evaluate ImageScript code');
		} finally {
			if (!isolate.isDisposed)
				isolate.dispose();
		}
	}
}

class FetchHandler {
	constructor() {
		this.calls = 0;
	}

	async fetch(url, {method, headers, body} = {}) {
		if (typeof url !== 'string')
			return new TypeError('url must be string');

		if (http.METHODS.includes(method?.toLowerCase() ?? 'get'))
			return new RangeError('unsupported http method');

		const cleanHeaders = {};
		for (const [key, value] of Object.entries(headers ?? {})) {
			if (typeof key !== 'string')
				return new TypeError('header key must be string');
			if (typeof value !== 'string')
				return new TypeError('header value must be string');

			cleanHeaders[key] = value;
		}

		if (body !== undefined && !ArrayBuffer.isView(body) && typeof body !== 'string')
			return new TypeError('body must be arraybuffer or string');

		const CACHEABLE = ['https://unpkg.com/imagescript@', 'https://raw.githubusercontent.com/matmen/ImageScript/'].some(prefix => url.startsWith(prefix));

		if (CACHEABLE) {
			const cacheEntry = await ImageScriptResource.find(url);
			if (cacheEntry) {
				return {
					headers: {},
					redirected: false,
					status: 200,
					statusText: 'OK',
					ok: true,
					url,

					arrayBuffer: Buffer.from(cacheEntry.body, 'base64').buffer
				};
			}
		}

		if (++this.calls > 20)
			return new RangeError('Too many fetch calls (10 allowed)');

		let result;
		try {
			const response = await fetch(url, {
				method,
				headers: cleanHeaders,
				body
			});

			result = {
				headers: response.headers,
				redirected: response.redirected,
				status: response.status,
				statusText: response.statusText,
				ok: response.ok,
				url: response.url,

				arrayBuffer: await response.arrayBuffer()
			};
		} catch (err) {
			result = {
				message: err.message,
				name: err.name,
				error: true
			};
		}

		if (CACHEABLE && !(result instanceof Error) && result.ok) {
			const cacheEntry = new ImageScriptResource({
				url,
				body: Buffer.from(result.arrayBuffer).toString('base64')
			});

			await cacheEntry.create();
		}

		return result;
	}
}

module.exports = ImageScript;
