const HTTPProxyAgent = require('http-proxy-agent');
const HTTPSProxyAgent = require('https-proxy-agent');
const nodeFetch = require('node-fetch');

const USER_AGENT = 'pxlAPI/1.0 (+https://pxlapi.dev)';
const MAX_SIZE = 16000000;

module.exports = async function fetch(url, args = {}) {
	args.headers = args.headers ?? {};
	args.headers['User-Agent'] = USER_AGENT;

	const parsedURL = new URL(url);
	if (!['http:', 'https:'].includes(parsedURL.protocol))
		throw new Error('Unsupported URL protocol');

	const https = parsedURL.protocol === 'https:';
	const proxyURL = process.env[https ? 'https_proxy' : 'http_proxy'];
	if (proxyURL)
		args.agent = (https ? HTTPSProxyAgent : HTTPProxyAgent)(proxyURL);

	if (args.timeout === undefined)
		args.timeout = 10000;
	if (args.size === undefined)
		args.size = MAX_SIZE;

	try {
		return await nodeFetch(url, args);
	} catch (err) {
		if (err.message.includes(`${args.agent.proxy.host}:${args.agent.proxy.port}`))
			throw new Error('Failed to connect to proxy');

		if (err.message.includes('content size'))
			throw new Error(`Content exceeds ${Math.floor(args.size / 1000 ** 2 * 10) / 10}MB`);
	}
};

module.exports.USER_AGENT = USER_AGENT;
