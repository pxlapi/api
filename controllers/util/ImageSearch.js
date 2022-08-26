const playwright = require('playwright');
const Controller = require('../../util/http/controller/Controller');
const ImageSearchResult = require('../../models/ImageSearchResult');
const Logger = require('../../util/log/Logger');
const Snowflake = require('../../util/Snowflake');
const {Transaction} = require('../../util/database/Handler');

const SAFE_SEARCH_LEVELS = {
	off: -2,
	moderate: undefined,
	strict: 1
};

class ImageSearch extends Controller {
	constructor(router) {
		super(router, '/image_search');
	}

	/**
	 * @api {post} /image_search Image Search
	 * @apiGroup Utility
	 * @apiDescription Searches the internet for images matching the given query
	 *
	 * @apiParam (Request Parameters) {string=1..128} query The query to search for
	 * @apiParam (Request Parameters) {string="off","moderate","strict"} [safeSearch="strict"] What safe search setting to use
	 * @apiParam (Request Parameters) {boolean} [meta=false] Whether to return meta data (page title and URL)
	 *
	 * @apiSuccess {string[]|object[]} body An array of image URLs (when `meta = false`) or image objects (when `meta = true`)
	 * @apiSuccess {string} body.url The images URL
	 * @apiSuccess {string} body.title The images page title
	 * @apiSuccess {string} body.location The images location (page URL)
	 *
	 * @apiError 400 No results were found
	 *
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const query = context.parameters.get('query');
		if (typeof query !== 'string' || query.length < 1 || query.length > 128)
			return context.badRequest('INVALID_QUERY');
		const safeSearch = context.parameters.get('safeSearch') ?? 'strict';
		if (!Object.keys(SAFE_SEARCH_LEVELS).includes(safeSearch))
			return context.badRequest('INVALID_SAFE_SEARCH_LEVEL');
		const meta = ['1', 'true', true].includes(context.parameters.get('meta'));

		const safeSearchLevel = SAFE_SEARCH_LEVELS[safeSearch];

		const cachedResults = await ImageSearchResult.list({
			query,
			safe_search: safeSearchLevel
		}, null, {order: {id: 'ASC'}});
		if (cachedResults.length) {
			context.ok(cachedResults.map(result => meta ? ({
				url: result.url,
				title: result.title,
				location: result.location
			}) : result.url));
			if (Date.now() - Snowflake.toDate(cachedResults[0].id, true) < 1000 * 60 * 60 * 3)
				return;
		}

		const browserInitStart = Date.now();

		const browser = await playwright.chromium.launch();
		setTimeout(() => {
			if (browser.isConnected())
				browser.close();
		}, 30000);

		const browserContext = await browser.newContext({
			extraHTTPHeaders: {
				'Cookie': safeSearchLevel ? `p=${safeSearchLevel}` : undefined
			}
		});

		const page = await browserContext.newPage();

		await page.route('**/*', (route, request) => {
			if (['font', 'image', 'stylesheet'].includes(request.resourceType()))
				return route.abort();
			route.continue();
		});

		await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`, {timeout: 10000});
		context.creditsUsed -= (Date.now() - browserInitStart) / 10;

		const extractionStart = Date.now();

		await Promise.race(['.zci__no-results__txt', '.tile--img__img', '#error_homepage'].map(selector => page.waitForSelector(selector, {timeout: 10000})));

		if (await page.$('.zci__no-results__txt')) {
			context.badRequest('No Results Found');
			return await browser.close();
		} else if (await page.$('#error_homepage')) {
			context.badRequest('Search Engine returned an error');
			return await browser.close();
		}

		const results = await page.$$eval(
			'.tile--img__img',
			ImageSearch.extractMeta
		);

		context.creditsUsed -= (Date.now() - extractionStart) / 15;

		if (!cachedResults.length)
			context.ok(meta ? results : results.map(result => result.url));

		await browser.close();

		const cachedURLs = cachedResults.map(cachedResult => cachedResult.url);

		const transaction = new Transaction();
		for (const {url, title, location} of results.filter(meta => !cachedURLs.includes(meta.url))) {
			const cacheModel = new ImageSearchResult({
				query,
				url,
				title,
				location,
				safe_search: safeSearchLevel
			});

			try {
				await cacheModel.create(transaction);
			} catch (err) {
				await transaction.rollback();
				return Logger.error(err);
			}
		}

		await transaction.commit();
	}

	static extractMeta(elements) {
		return elements.map(element => ({
			url: decodeURIComponent(element.src.split('?u=')[1]),
			title: element.alt,
			location: element.parentElement.parentElement.parentElement.querySelector('a').href
		}));
	}
}

module.exports = ImageSearch;
