const User = require('../../models/user/User');
const Application = require('../../models/application/Application');
const AccessToken = require('../../models/user/AccessToken');

class AuthorizationProvider {
	/**
	 * @param {string} type
	 * @param {string} token
	 * @returns {Promise<{application: Application | null, accessToken: AccessToken | null, user: User | null}>}
	 */
	static async from(type, token) {
		type = type.toLowerCase();

		let user, application, accessToken;

		if (type === 'application') {
			application = await Application.find({token, active: true});
			if (application)
				user = await User.find({
					id: application.owner_id,
					permissions_value_ba: User.permissions.from(User.permissionNames, ['active'])
				});

			if (!user)
				application = null;
			else if (!user.permissions.verifiedEmail)
				throw new Error('Email address not verified');
		} else if (type === 'user') {
			accessToken = await AccessToken.find({token});

			if (accessToken) {
				if (new Date(accessToken.expires_at).valueOf() < Date.now()) {
					await accessToken.delete();
					accessToken = null;
				} else user = await User.find({
					id: accessToken.user_id,
					permissions_value_ba: User.permissions.from(User.permissionNames, ['active'])
				});
			}

			if (!user) {
				accessToken = null;
				user = null;
			}
		}

		return {user, application, accessToken};
	}
}

module.exports = AuthorizationProvider;
