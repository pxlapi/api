const ConfigManager = require('../config/Manager');
const fetch = require('../fetch/Fetch');
const scores = {
	registration: .7,
	login: .7,
	default: .5
};

class CaptchaProvider {
	static async check(captcha, targetAction) {
		if(process.env.NODE_ENV !== 'production')
			return;

		const body = {
			secret: ConfigManager.current.captcha.secret,
			response: captcha
		};

		const result = await fetch('https://www.google.com/recaptcha/api/siteverify', {
			method: 'POST',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: Object.entries(body).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
		});

		if (!result.ok)
			return new Error('reCaptcha returned invalid response');

		const {success, score, action} = await result.json();
		if (!success)
			return new Error('reCaptcha reported invalid captcha');
		if (action !== targetAction)
			return new Error('Invalid action');
		if (score < (scores[targetAction] ?? scores.default))
			return new Error('reCaptcha detected suspicious activity');
	}
}

module.exports = CaptchaProvider;
