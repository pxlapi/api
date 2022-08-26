const VerificationToken = require('../../../models/user/VerificationToken');
const User = require('../../../models/user/User');
const CaptchaProvider = require('../../../util/captcha/CaptchaProvider');
const ManagementController = require('../../../util/http/controller/ManagementController');
const {Transaction} = require('../../../util/database/Handler');

class VerificationController extends ManagementController {
	constructor(router) {
		super(router, '/management/verification_tokens/{token}');
	}

	async post(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');
		if (context.path.has('token'))
			return context.badRequest();
		if (context.user.permissions.verifiedEmail)
			return context.badRequest('Account is already verified');

		const captcha = context.request.headers['x-captcha'];
		const captchaResult = await CaptchaProvider.check(captcha, 'verifyCreate');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		const existingTokens = await VerificationToken.list({
			user_id: context.user.id,
			created_at_gt: new Date(Date.now() - 1000 * 60 * 10)
		});
		if (existingTokens.length >= 3)
			return context.tooManyRequests(`You are creating verification tokens too fast. Please try again later.`);

		const verificationToken = await new VerificationToken({
			token: VerificationToken.generateToken(),
			user_id: context.user.id,
			created_at: new Date()
		}).create();

		await context.mailer.sendMail(context.user.email_address, 'registration', {
			displayName: context.user.display_name,
			verificationToken: verificationToken.token
		});

		context.ok();
	}

	async delete(context) {
		const token = context.path.get('token');
		if (!token)
			return context.notFound(VerificationToken.invalid);

		const captcha = context.request.headers['x-captcha'];
		const captchaResult = await CaptchaProvider.check(captcha, 'verify');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		/** @type {VerificationToken|null} */
		const tokenModel = await VerificationToken.find({token});
		if (!tokenModel)
			return context.notFound(VerificationToken.invalid);

		/** @type {Model|User} */
		let user = await User.find({id: tokenModel.user_id});

		const transaction = new Transaction();
		try {
			user = await user.update({
				permissions_value: User.permissions.from(User.permissionNames, [...user.permissions.grantedNames, 'verifiedEmail']),
				updated_at: new Date()
			}, transaction);
		} catch (err) {
			context.error(err);
			return await transaction.rollback();
		}

		try {
			await tokenModel.delete(transaction);
		} catch (err) {
			context.error(err);
			return await transaction.rollback();
		}

		await transaction.commit();

		context.ok(user);
	}
}

module.exports = VerificationController;
