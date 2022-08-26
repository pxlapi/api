const User = require('../../../models/user/User');
const VerificationToken = require('../../../models/user/VerificationToken');
const Application = require('../../../models/application/Application');
const Logger = require('../../../util/log/Logger');
const {Transaction} = require('../../../util/database/Handler');
const CaptchaProvider = require('../../../util/captcha/CaptchaProvider');
const ManagementController = require('../../../util/http/controller/ManagementController');

/**
 * @apiDefine UserResponse
 * @apiSuccess {string} id The users unique ID
 * @apiSuccess {string} email_address The users email address
 * @apiSuccess {string} display_name The users display name
 * @apiSuccess {number} permissions_value The users permissions integer
 * @apiSuccess {string|null} discord_id The users linked Discord account ID
 * @apiSuccess {number|null} quota The users processing time quota (in ms)
 * @apiSuccess {number} monthly_credits The users remaining monthly credits
 * @apiSuccess {number} credits The users remaining purchased credits
 * @apiSuccess {number|null} credit_alert The users active credit alert
 */

class UserController extends ManagementController {
	constructor(router) {
		super(router, '/management/users/{id}');
	}

	async get(context) {
		if (context.path.has('id'))
			return this.__show__(context);
		return this.__index__(context);
	}

	/** @param {RequestContext} context */
	async __index__(context) {
		if (!context.user)
			return context.unauthorized();
		if (!context.user.permissions.admin)
			return context.forbidden();

		const users = await User.list({
			permissions_value_ba: User.permissions.from(User.permissionNames, ['active'])
		});

		context.ok(users);
	}

	/**
	 * @api {get} /management/users/:id Show User
	 * @apiGroup ~Management
	 * @apiDescription Gets the given users data
	 * @apiParam (Path Arguments) {string} id The users ID (or "@" for the authenticated user)
	 * @apiHeader {string} Authorization Access token ("Application APPLICATION_TOKEN")
	 *
	 * @apiUse UserResponse
	 * @apiUse Unauthorized
	 * @apiUse NotFound
	 * @apiUse Forbidden
	 */
	/** @param {RequestContext} context */
	async __show__(context) {
		if (!context.user)
			return context.unauthorized();

		const idStr = context.path.get('id');

		if (['@', context.user.id].includes(idStr))
			return context.ok(context.user);

		if (!context.user.permissions.admin)
			return context.forbidden();

		/** @type {User} */
		const user = await User.find({id: idStr});
		if (!user)
			return context.notFound();

		context.ok(user);
	}

	async post(context) {
		const {captcha} = context.body;
		const captchaResult = await CaptchaProvider.check(captcha, 'register');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		const transaction = new Transaction();

		if (!User.model.password.validate(context.body.password))
			return context.badRequest(User.invalidPassword);

		const userModel = new User({
			email_address: context.body.email_address,
			display_name: context.body.display_name,
			password: await User.hashPassword(context.body.password ?? ''),
			permissions_value: User.permissions.from(User.permissionNames, ['active']),
			updated_at: new Date()
		});

		let user;
		try {
			user = await userModel.create(transaction);
		} catch (err) {
			if (err instanceof User.InvalidModelError)
				context.badRequest(err.message);
			else if (err.message.includes('users_email_address_key'))
				context.badRequest(User.duplicateEmail);
			else context.error(err);

			return await transaction.rollback();
		}

		try {
			const application = new Application({
				owner_id: user.id,
				display_name: `${user.display_name.substr(0, 40)}'s first application`,
				active: true,
				token: Application.generateToken(),
				updated_at: new Date()
			});

			await application.create(transaction);
		} catch (err) {
			context.error(err);
			return transaction.rollback();
		}

		let verificationToken;
		try {
			verificationToken = await new VerificationToken({
				token: VerificationToken.generateToken(),
				user_id: user.id,
				created_at: new Date()
			}).create(transaction);
		} catch (err) {
			context.error(err);
			return transaction.rollback();
		}

		context.mailer.sendMail(user.email_address, 'registration', {
			displayName: user.display_name,
			verificationToken: verificationToken.token
		}).catch(e => Logger.error(e));

		await transaction.commit();
		context.ok(user);
	}

	async patch(context) {
		const id = context.path.get('id');
		if (!id)
			return context.notFound();
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		const {captcha} = context.body;
		const captchaResult = await CaptchaProvider.check(captcha, 'editUser');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		/** @type {User} */
		let user;
		if ([context.user.id, '@'].includes(id))
			user = context.user;
		else
			user = await User.find({id});

		if (!user)
			return context.notFound();
		if (user.id !== context.user.id && !context.user.permissions.admin)
			return context.forbidden();

		let {display_name, permissions_value, password, quota, email_address, discord_id} = context.body;
		if (typeof quota === 'string') {
			if (!quota)
				quota = null;
			else
				quota = parseInt(quota);
		}

		let needReverification = false;
		if (!context.user.permissions.admin) {
			permissions_value = user.permissions_value;

			if (email_address && email_address !== user.email_address) {
				needReverification = true;
				permissions_value = user.permissions_value & ~User.permissions.from(User.permissionNames, ['verifiedEmail']);
			}
		} else if (permissions_value && user.permissions.admin)
			permissions_value |= User.permissions.from(User.permissionNames, ['admin']);

		let passwordChanged = false;
		if (![null, undefined].includes(password)) {
			if (!User.model.password.validate(password))
				return context.badRequest(User.invalidPassword);
			if (!await User.comparePassword(user.password, password))
				passwordChanged = true;
			password = await User.hashPassword(password);
		}

		if (discord_id === null && !(password ?? user.password))
			return context.badRequest('Cannot unlink Discord account when no password is set');

		const transaction = new Transaction();

		const updatedUser = await user.update({
			email_address: email_address ?? user.email_address,
			display_name: display_name ?? user.display_name,
			permissions_value: permissions_value ?? user.permissions_value,
			password: password ?? user.password,
			quota: quota === undefined ? user.quota : quota,
			discord_id: discord_id === undefined ? user.discord_id : discord_id,
			updated_at: new Date()
		}, transaction);

		if (needReverification) {
			for (const verificationToken of await VerificationToken.list({user_id: user.id}))
				await verificationToken.delete();

			let verificationToken;
			try {
				verificationToken = await new VerificationToken({
					token: VerificationToken.generateToken(),
					user_id: user.id,
					created_at: new Date()
				}).create(transaction);
			} catch (err) {
				context.error(err);
				return transaction.rollback();
			}

			context.mailer.sendMail(user.email_address, 'emailChanged', {
				displayName: user.display_name
			}).catch(e => Logger.error(e));

			context.mailer.sendMail(updatedUser.email_address, 'reverification', {
				displayName: user.display_name,
				verificationToken: verificationToken.token
			}).catch(e => Logger.error(e));
		} else if (passwordChanged) {
			context.mailer.sendMail(user.email_address, 'passwordChanged', {
				displayName: user.display_name
			}).catch(e => Logger.error(e));
		}

		await transaction.commit();

		context.ok(updatedUser);
	}

	async delete(context) {
		const id = context.path.get('id');
		if (!id)
			return context.notFound();
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		/** @type {User} */
		let user;
		if ([context.user.id, '@'].includes(id))
			user = context.user;
		else
			user = await User.find({id});

		if (!user)
			return context.notFound();
		if (user.id !== context.user.id && !context.user.permissions.admin)
			return context.forbidden();
		if (user.permissions.admin)
			return context.forbidden('Admin users cannot be deleted');

		const deletedUser = await user.update({
			permissions_value: user.permissions_value & ~User.permissions.from(User.permissionNames, ['active']),
			email_address: `${user.id}@pxlapi`,
			discord_id: null,
			updated_at: new Date()
		});

		context.ok(deletedUser);
	}
}

module.exports = UserController;
