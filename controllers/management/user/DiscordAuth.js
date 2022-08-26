const fetch = require('../../../util/fetch/Fetch');
const {Transaction} = require('../../../util/database/Handler');
const Logger = require('../../../util/log/Logger');
const User = require('../../../models/user/User');
const Application = require('../../../models/application/Application');
const AccessToken = require('../../../models/user/AccessToken');
const VerificationToken = require('../../../models/user/VerificationToken');
const LocationProvider = require('../../../util/geoip/LocationProvider');
const CaptchaProvider = require('../../../util/captcha/CaptchaProvider');
const ManagementController = require('../../../util/http/controller/ManagementController');

class DiscordAuthController extends ManagementController {
	constructor(router) {
		super(router, '/management/discord_auth');
	}

	async get(context) {
		const {code, captcha, redirect} = Object.fromEntries(context.parameters.entries());

		const userResult = await DiscordAuthController.fetchDiscordUser(code, captcha, redirect, context.config.discord);
		if (userResult instanceof Error)
			return context.badRequest(userResult);

		const {id, username, discriminator, email, avatar} = userResult;

		context.ok({id, username, discriminator, email, avatar});
	}

	async post(context) {
		const {code, captcha, redirect} = context.body;
		const userResult = await DiscordAuthController.fetchDiscordUser(code, captcha, redirect, context.config.discord);
		if (userResult instanceof Error)
			return context.badRequest(userResult);

		const {id, username, email, verified} = userResult;

		let user = await User.find({discord_id: id});

		const transaction = new Transaction();

		if (!user) {
			const userModel = new User({
				email_address: email,
				display_name: username,
				discord_id: id,
				permissions_value: User.permissions.from(User.permissionNames, verified ? ['verifiedEmail', 'active'] : ['active']),
				updated_at: new Date()
			});

			try {
				user = await userModel.create(transaction);
			} catch (err) {
				if (err.message.includes('users_email_address_key'))
					context.badRequest(User.duplicateEmail);
				else context.error(err);

				return await transaction.rollback();
			}

			const application = new Application({
				owner_id: user.id,
				display_name: `${user.display_name}'s first application`,
				active: true,
				token: Application.generateToken(),
				updated_at: new Date()
			});

			try {
				await application.create(transaction);
			} catch (err) {
				context.error(err);
				return await transaction.rollback();
			}

			if (!verified) {
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
			}
		}

		const accessTokenModel = new AccessToken({
			token: AccessToken.generateToken(),
			user_id: user.id,
			created_at: new Date(),
			updated_at: new Date(),
			expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
			remote_addresses: context.remoteAddresses,
			location: await LocationProvider.geoipLookup(context.remoteAddresses)
		});

		try {
			const accessToken = await accessTokenModel.create(transaction);
			await transaction.commit();
			context.ok(accessToken);
		} catch (err) {
			context.error(err);
		}
	}

	static async fetchDiscordUser(code, captcha, redirect, discordConfig) {
		if (!code)
			return new Error('Missing Code');

		if (!['https://pxlapi.dev', 'http://localhost:5000', 'https://pxlapi-git-v2.matmen.vercel.app']
			.map(origin => `${origin}/discord-oauth`).includes(redirect))
			return new Error('Invalid redirect');

		const captchaResult = await CaptchaProvider.check(captcha, 'discord');
		if (captchaResult instanceof Error)
			return captchaResult;

		const body = new URLSearchParams();
		body.append('client_id', discordConfig.id);
		body.append('client_secret', discordConfig.secret);
		body.append('grant_type', 'authorization_code');
		body.append('code', code);
		body.append('redirect_uri', redirect);
		body.append('scope', 'identify email');

		const codeResponse = await fetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			body
		});

		if (!codeResponse.ok)
			return new Error('Failed to create token');

		const {token_type: tokenType, access_token: accessToken} = await codeResponse.json();

		const userResponse = await fetch('https://discord.com/api/v8/users/@me', {
			headers: {
				Authorization: `${tokenType} ${accessToken}`
			}
		});

		if (!userResponse.ok)
			return new Error('Failed to fetch user data');

		return await userResponse.json();
	}
}

module.exports = DiscordAuthController;
