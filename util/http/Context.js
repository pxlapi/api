const Sentry = require('@sentry/node');
const Logger = require('../log/Logger');
const MIMEDetector = require('./MIMEDetector');
const {Model, ModelList, InvalidModelError} = require('../database/Model');
const {Image, GIF, Frame} = require('../ImageScript/ImageScript');

/**
 * @typedef {string | number | IncomingJSON | boolean | null | (string | number | object | IncomingJSON | boolean | null)[] | object<string, IncomingJSON>} IncomingJSON
 */

/**
 * @property {IncomingMessage} request
 * @property {ServerResponse} response
 * @property {Map<string, string>} path
 * @property {URLSearchParams<string, string>} query
 * @property {Buffer|IncomingJSON} body
 * @property {Map<string, IncomingJSON>} parameters
 * @property {object} config
 * @property {Mailer} mailer
 * @property {AccessToken|null} accessToken
 * @property {User|null} user
 * @property {Application|null} application
 * @property {number|null} responseStatus
 * @property {string[]} remoteAddresses
 * @property {any} data
 * @property {number} creditsUsed
 */
class RequestContext {
	/**
	 * @param {IncomingMessage} request
	 * @param {ServerResponse} response
	 */
	constructor(request, response) {
		this.request = request;
		this.response = response;
		this.remoteAddresses = [this.request.headers['cf-connecting-ip'] ?? this.request.socket.remoteAddress];
		if (this.request.headers['x-forwarded-for'])
			this.remoteAddresses.push(...this.request.headers['x-forwarded-for'].split(',').slice(1, Infinity).map(x => x.trim()));
	}

	/**
	 * @param {Model|ModelList|string|object} [data]
	 */
	ok(data) {
		if ([Model, ModelList].some(parent => data instanceof parent))
			data = data.toAPIResponse();

		if (ArrayBuffer.isView(data)) {
			data = Buffer.from(data);
			this.response.setHeader('Content-Type', MIMEDetector.detect(data)?.mime ?? 'application/octet-stream');
		} else if (typeof data === 'object') {
			data = JSON.stringify(data);
			this.response.setHeader('Content-Type', 'application/json');
		}

		this.responseStatus = 200;
		this.data = data;
	}

	/**
	 * @param {Image, GIF, [Image]} data
	 */
	async okImage(data) {
		if (Array.isArray(data) && data.length === 1 && [Image, Frame].some(type => data[0] instanceof type))
			data = data[0];

		const maxSize = Math.max(64, Math.min(1024, this.parameters.get('maxSize') ?? 1024));
		if (isNaN(maxSize))
			throw new Error('INVALID_MAX_SIZE');

		if (data instanceof Image || data instanceof GIF) {
			if (data.width > maxSize)
				data.resize(maxSize, Image.RESIZE_AUTO);
			if (data.height > maxSize)
				data.resize(Image.RESIZE_AUTO, maxSize);

			data = await data.encode();
		}

		return this.ok(data);
	}

	/**
	 * @param {string|object|Error} [data]
	 */
	badRequest(data) {
		this.responseStatus = 400;

		if (data instanceof Error) {
			if (data.constructor.name === 'FetchError' && data.message.startsWith('content size'))
				data.message = `Content exceeds ${Math.floor(parseInt(data.message.split(': ')[1]) / 1000 ** 2 * 10) / 10}MB`;
			data = data.message;
		} else if (typeof data === 'object')
			data = JSON.stringify(data);

		this.data = data ?? 'Bad Request';
	}

	unauthorized(message) {
		this.responseStatus = 401;
		this.data = message ?? 'Unauthorized';
	}

	forbidden(message) {
		this.responseStatus = 403;
		this.data = message ?? 'Forbidden';
	}

	notFound(message) {
		this.responseStatus = 404;
		this.data = message instanceof Error ? message.message : (message ?? 'Not Found');
	}

	notAllowed(message) {
		this.responseStatus = 405;
		this.data = message ?? 'Not Allowed';
	}

	tooManyRequests(message) {
		this.responseStatus = 429;
		this.data = message ?? 'Too Many Requests';
	}

	/**
	 * @param {string|Error} data
	 */
	error(data) {
		if (data instanceof InvalidModelError)
			return this.badRequest(data);

		Logger.errorSilent(data);
		Sentry.withScope(scope => {
			scope.setExtra('user', this.user);
			scope.setExtra('application', this.application);
			scope.setExtra('accessToken', this.accessToken);

			scope.setExtra('path', Object.fromEntries(this.path.entries()));
			scope.setExtra('query', Object.fromEntries(this.query.entries()));
			scope.setExtra('body', Buffer.isBuffer(this.body) ? '[[BINARY BUFFER]]' : this.body);
			scope.setExtra('parameters', Object.fromEntries(this.parameters.entries()));

			scope.setExtra('remoteAddresses', this.remoteAddresses);

			Sentry.captureException(data, scope);
		});

		this.responseStatus = 500;
		this.data = 'Internal Server Error';
	}

	notImplemented() {
		this.responseStatus = 501;
		this.data = 'Not Implemented';
	}
}

module.exports = RequestContext;
