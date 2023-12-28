const Controller = require('../../util/http/controller/Controller');
const fetch = require('../../util/fetch/Fetch');

const SAFE_SEARCH_LEVELS = {
	off: -2,
	moderate: undefined,
	strict: 1
};

class WebSearch extends Controller {
	constructor(router) {
		super(router, '/web_search');
	}

	/**
	 * @api {post} /web_search Web Search
	 * @apiGroup Utility
	 * @apiDescription Searches the internet for websites matching the given query
	 *
	 * @apiParam (Request Parameters) {string=1..128} query The query to search for
	 * @apiParam (Request Parameters) {string="off","moderate","strict"} [safeSearch="strict"] What safe search setting to use
	 *
	 * @apiSuccess {object[]} results An array of web results
	 * @apiSuccess {string} results.title The result's title
	 * @apiSuccess {string} results.description The result's description
	 * @apiSuccess {string} results.url The result's URL
	 *
	 * @apiSuccess {object[]} news An array of news results
	 * @apiSuccess {string} news.title The news entry's title
	 * @apiSuccess {string} news.source The news entry's source
	 * @apiSuccess {string} [news.image] The news entry's image
	 * @apiSuccess {string} news.url The news entry's URL
	 *
	 * @apiSuccess {string[]} images An array of related image URLs. If you want to search for images only, use <a href="#PostImage_search">Image Search</a> instead.
	 *
	 * @apiSuccess {string[]} relatedQueries An array of related queries
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

		const safeSearchLevel = SAFE_SEARCH_LEVELS[safeSearch];

		const fetchStart = Date.now();
		const keyRequest = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
		if(!keyRequest.ok)
			context.badRequest('Search Engine returned an error');

		const key = (await keyRequest.text()).match(/vqd="([\s\S]+?)"/)?.[1];
		if(!key)
			return context.badRequest('Search Engine returned an error');

		const queryString = Object.entries({
			q: query,
			t: 'D',
			l: 'us-en',
			s: 0,
			dl: 'en',
			ct: 'US',
			ss_mkt: 'us',
			vqd: key,
			p_ent: '',
			ex: safeSearchLevel,
			sp: 0,
			biaexp: 'b',
			msvrtexp: 'b',
			videxp: 'a',
			eclsexp: 'b',
			flexp: 'b',
			aduexp: 'b',
			wrap: 1,
			bpa: 1,
			o: 'json'
		}).map(([key, value]) => value ? `${key}=${encodeURIComponent(value)}` : key).join('&');

		const response = await fetch(`https://links.duckduckgo.com/d.js?${queryString}`);
		if(!response.ok)
			context.badRequest('Search Engine returned an error');
		context.creditsUsed -= (Date.now() - fetchStart) / 11;

		const {results} = await response.json();

		context.ok({
			results: results.filter(r => r.u).map(r => ({
				title: r.t.replace('&amp;', '&'),
				description: r.a.replace(/<\/?[^>]+>/g, ''),
				url: r.u
			})),
			images: [],
			relatedQueries: [],
			news: []
		});
	}
}

module.exports = WebSearch;
