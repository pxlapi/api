const fs = require('fs/promises');
const {Image} = require('../../util/ImageScript/ImageScript');
const fetch = require('../../util/fetch/Fetch');
const Controller = require('../../util/http/controller/Controller');

const SCALES = {ms: 1};
SCALES.s = 1000 * SCALES.ms;
SCALES.m = 60 * SCALES.s;
SCALES.h = 60 * SCALES.m;
SCALES.d = 24 * SCALES.h;
SCALES.w = 7 * SCALES.d;
SCALES.mo = 30 * SCALES.d;
SCALES.y = 365 * SCALES.d;
let exchangeInfo;

/**
 * @api {post} /klines/:pair KLines
 * @apiGroup Utility
 * @apiDescription Creates a candlestick chart for the given coin pair / ticks
 *
 * @apiParam (Path Arguments) {string} [pair] The [coin pair](https://www.binance.com/api/v3/exchangeInfo) to generate a candlestick chart for (e.g. `BNBBUSD`). Optional if custom ticks are sent.
 * @apiParam (Request Parameters) {string="1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1mo"} [interval="1m"] Timespan between candlesticks
 * @apiParam (Request Parameters) {number=..1000} [limit=90] How many candlesticks to draw
 * @apiParam (Request Parameters) {number[][]} [ticks] Custom ticks (lets you send in [binance API compatible](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klinecandlestick-data) tick data)
 * @apiParam (Request Parameters) {object} [pair] Custom pair data to display
 * @apiParam (Request Parameters) {string} [pair.baseAsset] Custom base asset name to display
 * @apiParam (Request Parameters) {string} [pair.quoteAsset] Custom quote asset name to display
 *
 * @apiUse ReturnsImage
 * @apiUse BadRequest
 * @apiUse Unauthorized
 */
class KLines extends Controller {
	constructor(router) {
		super(router, '/klines/{pair}');
	}

	async post(context) {
		if (!context.application)
			return context.unauthorized();

		let pair = context.path.get('pair');

		let data;
		if (context.parameters.has('ticks')) {
			data = context.parameters.get('ticks');

			if (!Array.isArray(data))
				return context.badRequest('INVALID_TICKS');

			for (const tick of data) {
				if (!Array.isArray(tick) || tick.length < 7)
					return context.badRequest('INVALID_TICK');
				for (const value of tick)
					if (isNaN(value))
						return context.badRequest('INVALID_TICK_DATA');
			}

			pair = context.parameters.get('pair');
		} else {
			if (!pair)
				return context.badRequest('MISSING_PAIR');

			if (!exchangeInfo)
				exchangeInfo = await fetch('https://www.binance.com/api/v3/exchangeInfo').then(r => r.json());

			pair = exchangeInfo.symbols.find(symbol => symbol.symbol === pair);
			if (!pair)
				return context.badRequest('INVALID_PAIR');

			const response = await fetch(`https://www.binance.com/api/v3/klines?symbol=${context.path.get('pair')}&interval=${context.parameters.get('interval') ?? '1m'}&limit=${context.parameters.get('limit') ?? 90}`);
			if (!response.ok)
				return context.badRequest(await response.text());

			data = await response.json();
		}

		if (data.length < 2)
			return context.badRequest('TOO_LITTLE_DATA');

		const image = new Image(1240, 540);

		let minPrice = Number.MAX_VALUE;
		let maxPrice = 0;

		let minTime = Number.MAX_VALUE;
		let maxTime = 0;

		const font = await fs.readFile('./assets/fonts/Consolas.ttf');

		const ticks = data.map((tick) => {
			const newTick = {
				openTime: parseInt(tick[0]),
				open: parseFloat(tick[1]),
				high: parseFloat(tick[2]),
				low: parseFloat(tick[3]),
				close: parseFloat(tick[4]),
				volume: parseFloat(tick[5]),
				closeTime: parseInt(tick[6])
			};

			if (newTick.high > maxPrice)
				maxPrice = newTick.high;

			if (newTick.low < minPrice)
				minPrice = newTick.low;

			if (newTick.openTime < minTime)
				minTime = newTick.openTime;

			if (newTick.closeTime > maxTime)
				maxTime = newTick.closeTime;

			return newTick;
		});

		const usdFormatterWhole = {
			format(amount) {
				return `${amount.toFixed(0)} ${pair?.quoteAsset ?? ''}`;
			}
		};

		const usdFormatter = {
			format(amount) {
				return `${amount.toFixed(2)} ${pair?.quoteAsset ?? ''}`;
			}
		};

		const usdFormatterPrecise = {
			format(amount) {
				return `${amount < 0.0001 ? amount.toExponential(4) : amount.toFixed(4)} ${pair?.quoteAsset ?? ''}`;
			}
		};

		function formatDollar(i) {
			if (i < 10) {
				return usdFormatterPrecise.format(parseFloat(i));
			} else if (i > 1000) {
				return usdFormatterWhole.format(parseFloat(i));
			} else {
				return usdFormatter.format(parseFloat(i));
			}
		}

		function formatTime(t, precision = 2) {
			let offset = Math.round((maxTime - t) / 1000) * 1000;

			if (offset <= 1000)
				return 'now';

			let values = [];
			for (const scale of Object.values(SCALES).reverse()) {
				const scaled = ~~(offset / scale);
				values.push(scaled);
				offset -= scaled * scale;
			}

			const firstNotZero = values.findIndex(value => !!value);
			values = values.slice(firstNotZero, firstNotZero + precision);

			const suffixes = Object.keys(SCALES).reverse().slice(firstNotZero, firstNotZero + precision);
			const timeStr = values
				.map((value, index) => value ? `${value}${suffixes[index].toLowerCase()}` : '')
				.join(' ')
				.replace(/\s+/g, ' ');

			return `-${timeStr}`;
		}

		const COLOR_BG = Image.rgbToColor(0x0E, 0x11, 0x17);
		const COLOR_CHART = Image.rgbToColor(0x30, 0x36, 0x3D);
		const COLOR_WHITE = Image.rgbToColor(255, 255, 255);

		const COLOR_GREEN = Image.rgbToColor(0x03, 0xC0, 0x76);
		const COLOR_RED = Image.rgbToColor(0xD9, 0x30, 0x4E);

		const MARGIN_H = 80;
		const MARGIN_W = 120;

		image.fill(COLOR_BG);

		if (pair?.baseAsset || pair?.quoteAsset) {
			const heading = await Image.renderText(font, 24, [pair?.baseAsset, pair?.quoteAsset].filter(x => !!x).join('/'), 0xffffffC0);
			image.composite(heading, image.width / 2 - heading.width / 2, MARGIN_H / 2 - heading.height / 2);
		}

		image.drawBox(MARGIN_W, MARGIN_H, 1, image.height - MARGIN_H * 2, COLOR_CHART);
		image.drawBox(image.width - MARGIN_W, MARGIN_H, 1, image.height - MARGIN_H * 2, COLOR_CHART);
		image.drawBox(MARGIN_W, MARGIN_H, image.width - MARGIN_W * 2, 1, COLOR_CHART);
		image.drawBox(MARGIN_W, image.height - MARGIN_H, image.width - MARGIN_W * 2, 1, COLOR_CHART);

		const CHART_O = {
			x: MARGIN_W,
			y: MARGIN_H
		};

		const CHART_H = image.height - (MARGIN_H * 2);
		const CHART_W = image.width - (MARGIN_W * 2);

		const tMin = await Image.renderText(font, 12, formatDollar(minPrice), COLOR_WHITE);
		image.composite(tMin, CHART_O.x - tMin.width - 8, CHART_O.y - tMin.height / 2 + CHART_H);

		const tMax = await Image.renderText(font, 12, formatDollar(maxPrice), COLOR_WHITE);
		image.composite(tMax, CHART_O.x - tMax.width - 8, CHART_O.y - tMax.height / 2);

		const TICK_SIZE = CHART_W / ticks.length;
		const PRICE_RANGE_DIFF = maxPrice - minPrice;

		{
			const DIV_SIZE = CHART_H / 10;
			let divY = CHART_O.y + DIV_SIZE;
			for (let i = 1; i < 10; i++) {
				image.drawBox(CHART_O.x + 1, divY, CHART_W - 1, 1, (x) => {
					if (x % 4 === 0) return COLOR_CHART;
					return COLOR_BG;
				});
				const price = maxPrice - ((PRICE_RANGE_DIFF / 10) * i);
				const tDivPrice = await Image.renderText(font, 12, formatDollar(price), COLOR_WHITE);
				image.composite(tDivPrice, CHART_O.x - tDivPrice.width - 8, divY - tDivPrice.height / 2);
				divY += DIV_SIZE;
			}
		}

		const TIME_RANGE_DIFF = maxTime - minTime;
		{
			const DIV_SIZE = CHART_W / 10;
			let divX = CHART_O.x;
			for (let i = 0; i <= 10; i++) {
				if (i !== 10) {
					image.drawBox(divX + TICK_SIZE / 2, CHART_O.y + 1, 1, CHART_H - 1, (x, y) => {
						if (y % 4 === 0) return COLOR_CHART;
						return COLOR_BG;
					});
				}

				const time = minTime + ((TIME_RANGE_DIFF / 10) * i);
				const tDivPrice = await Image.renderText(font, 10, formatTime(time), COLOR_WHITE);
				image.composite(tDivPrice, divX - tDivPrice.width / 2 + TICK_SIZE / 2, CHART_O.y + CHART_H + tDivPrice.height / 2);
				divX += DIV_SIZE;
			}
		}

		const yResolver = (price) => {
			const priceButRangeAligned = maxPrice - price;

			const yPercent = (priceButRangeAligned / PRICE_RANGE_DIFF);
			return yPercent * CHART_H;
		};

		{
			let tick = ticks[ticks.length - 1];
			const color = (tick.close > tick.open) ? COLOR_GREEN : COLOR_RED;
			const priceY = CHART_O.y + yResolver(tick.close);
			image.drawBox(CHART_O.x + 1, priceY, CHART_W - 1, 1, (x) => {
				if (x % 4 === 0) return color;
				return COLOR_BG;
			});

			const currentPrice = await Image.renderText(font, 12, formatDollar(tick.close), color);
			image.composite(currentPrice, CHART_O.x + CHART_W + 2, priceY - currentPrice.height / 2);
		}

		let currentX = CHART_O.x;
		for (const tick of ticks) {
			const highY = CHART_O.y + yResolver(tick.high);
			const lowY = CHART_O.y + yResolver(tick.low);

			const openY = CHART_O.y + yResolver(tick.open);
			const closeY = CHART_O.y + yResolver(tick.close);

			const color = (tick.close > tick.open) ? COLOR_GREEN : COLOR_RED;

			image.drawBox(currentX + TICK_SIZE / 2, highY, 1, lowY - highY, color);

			if (closeY > openY) {
				image.drawBox(currentX + TICK_SIZE / 2 - TICK_SIZE / 4, openY, TICK_SIZE / 2 + 1, closeY - openY, color);
			} else {
				image.drawBox(currentX + TICK_SIZE / 2 - TICK_SIZE / 4, closeY, TICK_SIZE / 2 + 1, openY - closeY, color);
			}

			currentX += TICK_SIZE;
		}

		context.ok(await image.encode());
	}
}

module.exports = KLines;
