const ConfigManager = require('../../../util/config/Manager');
const stripe = require('stripe')(ConfigManager.current.stripe.key);
const CaptchaProvider = require('../../../util/captcha/CaptchaProvider');
const Payment = require('../../../models/payments/Payment');
const ManagementController = require('../../../util/http/controller/ManagementController');
const {Transaction} = require('../../../util/database/Handler');

const PRICE_PER_CREDIT = 1 / 100_000;

class Payments extends ManagementController {
	constructor(router) {
		super(router, '/management/payments/{id}');
	}

	async get(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		const id = context.path.get('id');
		let result;
		if (id)
			result = await Payment.find({id});
		else
			result = await Payment.list({user_id: context.user.id}, null, {order: {created_at: 'DESC'}});

		context.ok(result);
	}

	async post(context) {
		if (!context.user)
			return context.unauthorized();
		if (context.application)
			return context.forbidden('Applications cannot perform this action');

		let credits = context.parameters.get('credits');
		if (isNaN(credits))
			return context.badRequest('INVALID_CREDITS');
		credits = parseInt(credits);
		if (credits < 100_000 || credits > 10_000_000)
			return context.badRequest('INVALID_CREDITS');

		const captcha = await context.parameters.get('captcha');
		const captchaResult = await CaptchaProvider.check(captcha, 'paymentCreate');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		const redirect = context.parameters.get('redirect');

		const price = Math.floor(PRICE_PER_CREDIT * credits * 100);

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [{
				price_data: {
					currency: 'usd',
					product_data: {
						name: `${credits.toLocaleString('en-US')} pxlAPI credits`
					},
					unit_amount: price
				},
				quantity: 1
			}],
			mode: 'payment',
			success_url: `${redirect}?payment={CHECKOUT_SESSION_ID}`,
			cancel_url: `${redirect}?payment={CHECKOUT_SESSION_ID}`,
			customer_email: context.user.email_address
		});

		const payment = new Payment({
			id: session.id,
			user_id: context.user.id,
			amount_credits: credits,
			amount_usd: price / 100,
			status: session.payment_status,
			created_at: new Date(),
			updated_at: new Date()
		});

		await payment.create();

		context.ok(payment);
	}

	async patch(context) {
		const id = context.path.get('id');
		if (!id)
			return context.notAllowed();

		const captcha = await context.parameters.get('captcha');
		const captchaResult = await CaptchaProvider.check(captcha, 'paymentUpdate');
		if (captchaResult instanceof Error)
			return context.badRequest(captchaResult);

		let payment = await Payment.find({id});
		if (!payment)
			return context.notFound();

		const session = await stripe.checkout.sessions.retrieve(id);
		if (session.payment_status === payment.status)
			return context.ok(payment);

		const transaction = new Transaction();
		try {
			const updatedPayment = await payment.update({
				status: session.payment_status,
				updated_at: new Date()
			});

			if (payment.status === 'unpaid' && updatedPayment.status === 'paid')
				await transaction.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [payment.amount_credits, payment.user_id]);

			await transaction.commit();

			context.ok(updatedPayment);
		} catch (err) {
			await transaction.rollback();
			return context.error(err);
		}
	}
}

module.exports = Payments;
