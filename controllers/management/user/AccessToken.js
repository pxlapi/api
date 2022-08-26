const AccessToken = require('../../../models/user/AccessToken');
const User = require('../../../models/user/User');
const CaptchaProvider = require('../../../util/captcha/CaptchaProvider');
const LocationProvider = require('../../../util/geoip/LocationProvider');
const ManagementController = require('../../../util/http/controller/ManagementController');

class AccessTokenController extends ManagementController {
	constructor(router) {
		super(router, '/management/access_tokens/{token}');
	}

	async get(context) {
		if (context.path.has('token'))
			return this.__show__(context);
		return this.__index__(context);
	}

	/** @param {RequestContext} context */
	async __index__(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		const tokens = await AccessToken.list({user_id: context.user.id, expires_at_gt: new Date()});
		context.ok(tokens);
	}

	/** @param {RequestContext} context */
	async __show__(context) {
		const tokenStr = context.path.get('token');

		if (['@', context.accessToken?.token].includes(tokenStr)) {
			if (!context.accessToken)
				return context.unauthorized();
			return context.ok(context.accessToken);
		}

		const token = await AccessToken.find({token: tokenStr, expires_at_gt: new Date()});
		if (!token)
			return context.notFound();

		context.ok(token);
	}

	async post(context) {
		const {email_address, password, lifetime, captcha} = context.body;
		const captchaResult = await CaptchaProvider.check(captcha, 'login');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		if (lifetime !== undefined && (typeof lifetime !== 'number' || lifetime < 0))
			return context.badRequest('INVALID_LIFETIME');
		if (!email_address || !password)
			return context.badRequest(User.invalid);

		/** @type {User} */
		const user = await User.find({
			email_address,
			permissions_value_ba: User.permissions.from(User.permissionNames, ['active'])
		});

		if (!user)
			return context.badRequest(User.invalid);

		if (!await User.comparePassword(user.password, password))
			return context.badRequest(User.invalid);

		const accessTokenModel = new AccessToken({
			token: AccessToken.generateToken(),
			user_id: user.id,
			created_at: new Date(),
			updated_at: new Date(),
			expires_at: new Date(Date.now() + (lifetime ?? 1000 * 60 * 60 * 24 * 7)),
			remote_addresses: context.remoteAddresses,
			location: await LocationProvider.geoipLookup(context.remoteAddresses)
		});

		try {
			const accessToken = await accessTokenModel.create();
			context.ok(accessToken);
		} catch (err) {
			context.error(err);
		}
	}

	async patch(context) {
		if (!context.path.has('token'))
			return context.badRequest(AccessToken.invalid);

		const {lifetime} = context.body;
		if (typeof lifetime !== 'number' || lifetime < 0)
			return context.badRequest('INVALID_LIFETIME');

		/** @type {Model} */
		let accessToken;
		if (context.path.get('token') === '@')
			accessToken = context.accessToken;
		else
			accessToken = await AccessToken.find({token: context.path.get('token')});

		if (!accessToken)
			return context.badRequest(AccessToken.invalid);

		/** @type {Model} */
		const updated = await accessToken.update({
			expires_at: new Date(Date.now() + lifetime),
			updated_at: new Date()
		});

		context.ok(updated);
	}

	async delete(context) {
		if (!context.path.has('token'))
			return context.notFound();

		/** @type {Model} */
		const accessToken = await AccessToken.find({token: context.path.get('token')});
		if (!accessToken)
			return context.notFound();

		/** @type {Model} */
		const deletedToken = await accessToken.delete();
		context.ok(deletedToken);
	}
}

module.exports = AccessTokenController;
