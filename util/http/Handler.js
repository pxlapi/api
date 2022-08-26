const http = require('http');
const RequestContext = require('./Context');
const Router = require('./Router');
const Logger = require('../log/Logger');
const ConfigManager = require('../config/Manager');
const Mailer = require('../mail/Mailer');
const LogEntry = require('../../models/log/Entry');
const UserQuota = require('../../models/cache/UserQuota');
const ApplicationQuota = require('../../models/cache/ApplicationQuota');
const WSHandler = require('../websocket/WSHandler');
const AuthorizationProvider = require('../authorization/AuthorizationProvider');
const CacheHandler = require('../database/Cache');
const ManagementController = require('./controller/ManagementController');
const {Transaction} = require('../database/Handler');
const {MAX_BODY_SIZE} = require('../Constants');

class HTTPHandler {
	constructor({port, controllerPath} = {port: 3000, controllerPath: './controllers/'}) {
		this.router = new Router(controllerPath);
		this.config = ConfigManager.current;
		this.mailer = new Mailer(this.config.mail);

		this.server = new http.Server(this.handleRequest.bind(this));
		this.server.listen(port);
		new WSHandler(this.server);
	}

	/**
	 * @param {IncomingMessage} request
	 * @param {ServerResponse} response
	 */
	async handleRequest(request, response) {
		const startTimestamp = process.hrtime.bigint();

		const context = new RequestContext(request, response);
		if (!request.headers['cf-connecting-ip'] && process.env.NODE_ENV === 'production') {
			context.forbidden();
			this.__send__(context);
			return await this.__logRequest__(context, null, request);
		}

		if (!http.METHODS.includes(request.method)) {
			context.notImplemented();
			this.__send__(context);
			return await this.__logRequest__(context, null, request);
		}

		if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
			if (!request.headers['content-length']) {
				context.responseStatus = 411;
				context.data = 'Length Required';
				this.__send__(context);
				return await this.__logRequest__(context, null, request);
			}

			if (request.headers['content-length'] > MAX_BODY_SIZE) {
				context.responseStatus = 413;
				context.data = 'Payload Too Large';
				this.__send__(context);
				return await this.__logRequest__(context, null, request);
			}
		}

		const queryIndex = request.url.indexOf('?');
		let path, query;
		if (queryIndex >= 0) {
			path = request.url.substring(0, queryIndex);
			query = request.url.substring(queryIndex + 1, request.url.length);
		} else {
			path = request.url;
		}

		const routeParams = this.router.find(path);
		if (!routeParams) {
			context.notFound();
			this.__send__(context);
			return await this.__logRequest__(context, routeParams, request);
		}

		const availableHandlers = http.METHODS.filter(method => routeParams.route.controller[method.toLowerCase()]);
		response.setHeader('Access-Control-Allow-Methods', availableHandlers.join(','));
		if (routeParams.route.controller instanceof ManagementController) {
			response.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' ? 'https://pxlapi.dev' : (request.headers.origin ?? '*'));
			response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Captcha');
		} else {
			response.setHeader('Access-Control-Allow-Origin', '*');
			response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
		}

		response.setHeader('Access-Control-Max-Age', 86400);

		const handlerFunction = routeParams.route.controller[request.method.toLowerCase()];
		if (!handlerFunction) {
			context.notAllowed();
			this.__send__(context);
			return await this.__logRequest__(context, routeParams, request);
		}

		context.query = new URLSearchParams(query);
		context.path = routeParams.pathArgs;
		try {
			context.body = await this.parseBody(request);
		} catch {
			context.badRequest('Invalid Payload');
			this.__send__(context);
			return await this.__logRequest__(context, routeParams, request);
		}
		context.parameters = new Map([...context.query.entries(), ...(Buffer.isBuffer(context.body) ? [] : Object.entries(context.body))]);
		context.config = this.config;
		context.mailer = this.mailer;
		context.accessToken = null;
		context.user = null;
		context.application = null;
		context.creditsUsed = 0;

		if (request.headers.authorization) {
			const [type, token] = request.headers.authorization.split(' ');
			if (!type || !token) {
				context.unauthorized();
				this.__send__(context);
				return await this.__logRequest__(context, routeParams, request);
			}

			try {
				const {user, application, accessToken} = await AuthorizationProvider.from(type, token);
				context.user = user;
				context.application = application;
				context.accessToken = accessToken;
			} catch (err) {
				context.badRequest(err);
				this.__send__(context);
				return await this.__logRequest__(context, routeParams, request);
			}
		}

		context.quotaUsed = {
			startsAt: Math.floor(Date.now() / 1000 / 60 / 60 / 24) * 24 * 60 * 60 * 1000,
			expiresAt: Math.ceil(Date.now() / 1000 / 60 / 60 / 24) * 24 * 60 * 60 * 1000
		};

		if (context.user && context.application) {
			const userQuota = (await UserQuota.find(context.user.id))?.quotaUsed ?? 0;
			context.quotaUsed.user = userQuota;
			if (context.user.quota !== null && userQuota >= context.user.quota) {
				context.tooManyRequests('User quota exceeded');
				this.__send__(context);
				return this.__logRequest__(context, routeParams, request);
			}

			const applicationQuota = (await ApplicationQuota.find(context.application.id))?.quotaUsed ?? 0;
			context.quotaUsed.application = applicationQuota;
			if (context.application.quota !== null && applicationQuota >= context.application.quota) {
				context.tooManyRequests('Application quota exceeded');
				this.__send__(context);
				return this.__logRequest__(context, routeParams, request);
			}

			if (context.user.monthly_credits + context.user.credits <= 0) {
				context.responseStatus = 402;
				context.data = 'Credits depleted';
				this.__send__(context);
				return this.__logRequest__(context, routeParams, request);
			}
		}

		const result = await Promise.resolve(handlerFunction.call(routeParams.route.controller, context)).catch(e => e);
		const timeTaken = Number(process.hrtime.bigint() - startTimestamp) / 1000000;

		if (context.application && context.responseStatus === 200) {
			context.creditsUsed += timeTaken / 10;
			context.creditsUsed = Math.round(context.creditsUsed);
		} else
			context.creditsUsed = null;

		if (context.user && context.application) {
			const userQuotaEntry = new UserQuota({
				userID: context.user.id,
				quotaUsed: context.quotaUsed.user + context.creditsUsed
			});

			const applicationQuotaEntry = new ApplicationQuota({
				applicationID: context.application.id,
				quotaUsed: context.quotaUsed.application + context.creditsUsed
			});

			const quotaExpiresIn = context.quotaUsed.expiresAt - Date.now();
			await Promise.all([userQuotaEntry.set(quotaExpiresIn), applicationQuotaEntry.set(quotaExpiresIn)]);

			if ((context.user.quota ?? context.application.quota) !== null) {
				response.setHeader('X-RateLimit-Limit', Math.min(context.user.quota, context.application.quota));
				response.setHeader('X-RateLimit-Reset', context.quotaUsed.expiresAt - Date.now());
				response.setHeader('X-RateLimit-Remaining', Math.min(
					context.user.quota - userQuotaEntry.quotaUsed,
					context.application.quota - applicationQuotaEntry.quotaUsed
				));
			}

			response.setHeader('X-Credits-Used', context.creditsUsed ?? 0);
		}

		if (result instanceof Error) {
			context.error(result);
			Logger.warnSilent(`Request to ${routeParams.route.controller.constructor.name} failed in ${timeTaken}ms`);
		} else
			Logger.info(`Request to ${routeParams.route.controller.constructor.name} finished in ${timeTaken}ms`);

		if (!response.headersSent)
			this.__send__(context);

		await this.__logRequest__(context, routeParams, request, timeTaken);
	}

	__send__(context) {
		if (!context.responseStatus) {
			context.response.end();
			return Logger.error('Request has finished with no status');
		}

		context.response.writeHead(context.responseStatus);

		if (['number', 'bigint', 'boolean'].includes(typeof context.data))
			context.data = context.data.toString();
		if (context.data)
			context.response.write(context.data);
		context.response.end();
	}

	async __logRequest__(context, routeParams, request, timeTaken) {
		const logEntry = new LogEntry({
			user_id: context.user?.id,
			application_id: context.application?.id,
			controller: routeParams?.route.controller.constructor.name.substr(0, 32),
			status: context.responseStatus,
			method: request.method,
			remote_addresses: context.remoteAddresses,
			time_taken: timeTaken ? `${timeTaken}ms` : null,
			user_agent: request.headers['user-agent']?.substr(0, 128),
			credits_used: context.creditsUsed || null
		});

		const transaction = new Transaction();
		if (context.creditsUsed) {
			const result = await transaction.query(
				'UPDATE users SET monthly_credits = monthly_credits - $1 WHERE id = $2 RETURNING monthly_credits',
				[context.creditsUsed, context.user.id]
			);

			const remainingMonthlyCredits = result.rows[0].monthly_credits;
			if (remainingMonthlyCredits < 0)
				await transaction.query(
					'UPDATE users SET monthly_credits = monthly_credits - $1, credits = credits + $1 WHERE id = $2',
					[remainingMonthlyCredits, context.user.id]
				);
		}

		const createdEntry = await logEntry.create(transaction);
		await transaction.commit();
		await CacheHandler.publish('logs', createdEntry);
	}

	async parseBody(request) {
		const [mime] = (request.headers['content-type'] ?? '').toLowerCase().split(';');
		const json = mime === 'application/json';

		let data = json ? '' : [];
		request.on('data', chunk => json ? data += chunk.toString() : data.push(chunk));

		return new Promise((resolve, reject) => {
			request.on('error', err => reject(err));
			request.on('end', () => {
				if (json) {
					try {
						resolve(JSON.parse(data));
					} catch (err) {
						reject(err);
					}
				} else resolve(Buffer.concat(data));
			});
		});
	}
}

module.exports = HTTPHandler;
