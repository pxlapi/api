const PasswordResetToken = require('../../../models/user/PasswordResetToken');
const User = require('../../../models/user/User');
const CaptchaProvider = require('../../../util/captcha/CaptchaProvider');
const ManagementController = require('../../../util/http/controller/ManagementController');
const {Transaction} = require('../../../util/database/Handler');

class PasswordResetController extends ManagementController {
	constructor(router) {
		super(router, '/management/password_reset_tokens/{token}');
	}

	async post(context) {
		const {email_address, captcha} = context.body;
		if (!email_address)
			return context.badRequest(User.invalid);

		const captchaResult = await CaptchaProvider.check(captcha, 'passwordResetRequest');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		/** @type {User} */
		const user = await User.find({email_address});
		if (!user)
			return context.badRequest(User.invalid);

		const existingTokens = await PasswordResetToken.list({user_id: user.id, expires_at_gt: new Date()});
		if (existingTokens.length >= 3)
			return context.tooManyRequests('You are requesting password resets too often. Please try again later.');

		const resetTokenModel = new PasswordResetToken({
			token: PasswordResetToken.generateToken(),
			user_id: user.id,
			created_at: new Date(),
			expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24)
		});

		/** @type {PasswordResetToken} */
		const resetToken = await resetTokenModel.create();

		await context.mailer.sendMail(user.email_address, 'passwordReset', {
			displayName: user.display_name,
			resetToken: resetToken.token
		});

		context.ok();
	}

	async delete(context) {
		const token = context.path.get('token');
		if (!token)
			return context.notFound(PasswordResetToken.invalid);

		const {password, captcha} = context.body;

		const captchaResult = await CaptchaProvider.check(captcha, 'passwordReset');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		/** @type {VerificationToken|null} */
		const tokenModel = await PasswordResetToken.find({token, expires_at_gt: new Date()});
		if (!tokenModel)
			return context.notFound(PasswordResetToken.invalid);

		if (!User.model.password.validate(password))
			return context.badRequest(User.invalidPassword);

		/** @type {Model|User} */
		let user = await User.find({id: tokenModel.user_id});

		const transaction = new Transaction();

		try {
			await tokenModel.delete(transaction);
		} catch (err) {
			context.error(err);
			return transaction.rollback();
		}

		try {
			user = await user.update({
				password: await User.hashPassword(password),
				edited_at: new Date()
			}, transaction);
		} catch (err) {
			context.error(err);
			return transaction.rollback();
		}

		await transaction.commit();

		context.ok(user);
	}
}

module.exports = PasswordResetController;
