const Controller = require('../../util/http/controller/Controller');
const fetch = require('../../util/fetch/Fetch');
const {chromium, firefox, devices} = require('playwright');
const {URL} = require('url');

class Screenshot extends Controller {
	constructor(router) {
		super(router, '/screenshot');
	}

	/**
	 * @api {post} /screenshot Screenshot
	 * @apiGroup Utility
	 * @apiDescription Screenshots the given URL (optionally with the given language and device emulation)
	 *
	 * @apiParam (Request Parameters) {string} url The URL to screenshot
	 * @apiParam (Request Parameters) {string} [device] The device to emulate.
	 * See [list of available devices](https://github.com/microsoft/playwright/blob/17e953c2d8bd19ace20059ffaaa85f3f23cfb19d/src/server/deviceDescriptors.js#L21-L857).
	 * Defaults to a non-specific browser with a viewport of 1920x1080 pixels.
	 * @apiParam (Request Parameters) {string} [locale=en-US] The locale to set the browser to
	 * @apiParam (Request Parameters) {string[]} [blocklist] A list of domains to block
	 * @apiParam (Request Parameters) {boolean} [defaultBlocklist=true] Whether to block a list of predefined, known-bad domains (e.g. NSFW content)
	 * @apiParam (Request Parameters) {string="chromium","firefox"} [browser="chromium"] What browser engine to use for screenshotting
	 * @apiParam (Request Parameters) {string="dark","light"} [theme="dark"] What theme to use
	 * @apiParam (Request Parameters) {number{1000..30000}} [timeout=20000] The max time to wait until the site has loaded (in ms)
	 * @apiParam (Request Parameters) {boolean} [fullPage=false] Whether to capture the entire page
	 *
	 * @apiUse ReturnsImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		let url = context.parameters.get('url');
		if (!url)
			return context.badRequest('MISSING_URL');
		if (typeof url !== 'string')
			return context.badRequest('INVALID_URL');
		if (!['http://', 'https://', 'view-source://'].some(proto => url.startsWith(proto)))
			url = `http://${url}`;

		const device = context.parameters.get('device');
		if (device && !Object.keys(devices).includes(device))
			return context.badRequest('INVALID_DEVICE');

		const locale = context.parameters.get('locale') ?? 'en-US';
		if (typeof locale !== 'string')
			return context.badRequest('INVALID_LOCALE');

		let blocklist = context.parameters.get('blocklist') ?? [];
		if (typeof blocklist === 'string')
			blocklist = [blocklist];
		if (!Array.isArray(blocklist))
			return context.badRequest('INVALID_BLOCKLIST');

		const theme = context.parameters.get('device') ?? 'dark';
		if (!['dark', 'light'].includes(theme))
			return context.badRequest('INVALID_THEME');

		const fullPage = [true, 'true', '1', 1].includes(context.parameters.get('fullPage') ?? false);

		const defaultBlocklist = ['1', 'true', true, '', undefined].includes(context.parameters.get('defaultBlocklist'));

		const browserIndex = ['chromium', 'firefox'].indexOf(context.parameters.get('browser'));
		let timeout = parseInt(context.parameters.get('timeout') ?? 20000);
		if (isNaN(timeout) || timeout < 1000 || timeout > 30000)
			return context.badRequest('INVALID_TIMEOUT');

		let browser, page;
		try {
			browser = await ([chromium, firefox][browserIndex] ?? chromium).launch({timeout});

			const {hostname} = new URL(url);
			await Screenshot.checkBlocklist(hostname, blocklist, defaultBlocklist);

			const browserContext = await browser.newContext({
				...(devices[device] ?? {width: 1920, height: 1080}),
				colorScheme: theme,
				locale: locale,
				geolocation: {latitude: 51.389250, longitude: 30.098957}, // not great, not terrible
				permissions: ['geolocation'],
				ignoreHTTPSErrors: true
			});

			await browserContext.addInitScript(`
			if(navigator.mediaDevices?.getUserMedia)
				navigator.mediaDevices.getUserMedia = undefined;
				
			navigator.webkitGetUserMedia = navigator.mozGetUserMedia = navigator.getUserMedia = webkitRTCPeerConnection = RTCPeerConnection = MediaStreamTrack = undefined;
			`);

			page = await browserContext.newPage();
			await page.emulateMedia({colorScheme: 'dark'});
			page.on('dialog', dialog => dialog.dismiss());

			const navigateStart = Date.now();
			await page.goto(url, {timeout, waitUntil: 'networkidle'});

			await Screenshot.checkBlocklist(await page.evaluate(() => document.domain, null), blocklist, defaultBlocklist);

			const result = await page.screenshot({fullPage});
			context.creditsUsed -= (Date.now() - navigateStart) / 20;
			context.ok(result);
		} catch (err) {
			const description = err.message.split('\n')[0];
			context.badRequest(description.includes(': ') ? description.split(': ')[1] : description);
		} finally {
			await browser.close();
		}
	}

	static async checkBlocklist(domain, customList, defaultBlocklist) {
		if (customList && (customList.includes(domain) || customList.includes(`www.${domain}`)))
			throw new Error('The provided URL is blocked');

		if (!defaultBlocklist)
			return;

		const {
			Answer: answer,
			Status: status
		} = await fetch(`https://qecb9fzujp.cloudflare-gateway.com/dns-query?name=${domain}`, {
			headers: {
				Accept: 'application/dns-json'
			}
		}).then(r => r.json());

		if (answer && answer.length && answer[0].data === '0.0.0.0' || status === 5)
			throw new Error('The provided URL is blocked');
	}
}

module.exports = Screenshot;
