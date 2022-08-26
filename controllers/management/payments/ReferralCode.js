const ReferralCode = require('../../../models/payments/ReferralCode');
const ReferralCodeUse = require('../../../models/payments/ReferralCodeUse');
const CaptchaProvider = require('../../../util/captcha/CaptchaProvider');
const ManagementController = require('../../../util/http/controller/ManagementController');
const {Transaction} = require('../../../util/database/Handler');

class ReferralCodeController extends ManagementController {
	constructor(router) {
		super(router, '/management/referral_codes/{name}');
	}

	async get(context) {
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		const captcha = context.request.headers['x-captcha'];
		const captchaResult = await CaptchaProvider.check(captcha, 'referralList');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		const name = context.path.get('name');

		if (!name) {
			if (!context.user)
				return context.unauthorized();
			if (!context.user.permissions.admin)
				return context.forbidden();

			const codes = await ReferralCode.list();
			return context.ok(codes);
		}

		const referralCode = await ReferralCode.find({name, active: true});
		if (!referralCode)
			return context.notFound();

		context.ok(referralCode);
	}

	async post(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		const name = context.path.get('name');

		if (!name) {
			if (!context.user.permissions.admin)
				return context.forbidden();

			return this.__create_code__(context);
		}

		return this.__use_code__(context, name);
	}

	async delete(context) {
		if (!context.user)
			return context.unauthorized();
		if (!context.user.permissions.admin)
			return context.forbidden();

		const name = context.path.get('name');
		const code = await ReferralCode.find({name, active: true});
		if (!code)
			return context.notFound();

		const result = await code.update({active: false});
		context.ok(result);
	}

	async __create_code__(context) {
		const code = new ReferralCode(context.body);
		const created = await code.create();

		return context.ok(created);
	}

	async __use_code__(context, name) {
		const captcha = context.parameters.get('captcha');

		const captchaResult = await CaptchaProvider.check(captcha, 'referralUse');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		const code = await ReferralCode.find({name});
		if (!code)
			return context.notFound();
		if (!code.active)
			return context.badRequest('CODE_EXPIRED');

		const totalUses = await ReferralCodeUse.list({name});
		if (code.max_redemptions && totalUses.length >= code.max_redemptions)
			return context.badRequest('CODE_EXPIRED');

		const userUses = await ReferralCodeUse.find({name, user_id: context.user.id});
		if (userUses)
			return context.forbidden('CODE_ALREADY_USED');

		const transaction = new Transaction();
		const codeUse = new ReferralCodeUse({name, user_id: context.user.id, timestamp: new Date()});

		try {
			await codeUse.create(transaction);
			if (code.max_redemptions && code.max_redemptions - totalUses.length <= 1)
				await code.update({active: false}, transaction);
			await transaction.query(
				'UPDATE users SET credits = credits + $1 WHERE id = $2',
				[code.credit_amount, context.user.id]
			);

			await transaction.commit();

			context.ok(code);
		} catch (err) {
			context.error(err);
			return await transaction.rollback();
		}
	}
}

module.exports = ReferralCodeController;
