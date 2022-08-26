const {Image} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

const COLORS = {
	asexual: [0x000000, 0xa4a4a4, 0xffffff, 0x810081],
	aromantic: [0x3aa63f, 0xa8d47a, 0xffffff, 0xaaaaaa, 0x000000],
	bisexual: [0xd70270, 0xd70270, 0x734f96, 0x0038a8, 0x0038a8],
	pansexual: [0xff218e, 0xfcd800, 0x0194fc],
	gay: [0xe40303, 0xff8c00, 0xffed00, 0x008026, 0x004dff, 0x750787],
	lesbian: [0xd62e02, 0xfd9855, 0xffffff, 0xd161a2, 0xa20160],
	trans: [0x55cdfc, 0xf7a8b8, 0xffffff, 0xf7a8b8, 0x55cdfc],
	nonbinary: [0xfff430, 0xffffff, 0x9c59d1, 0x000000],
	genderfluid: [0xff76a4, 0xffffff, 0xc011d7, 0x000000, 0x2f3cbe],
	genderqueer: [0xb57edc, 0xffffff, 0x498022],
	polysexual: [0xf714ba, 0x01d66a, 0x1594f6],

	austria: [0xed2939, 0xffffff, 0xed2939],
	belgium: [0x000000, 0xfdda24, 0xef3340],
	botswana: [...new Array(9).fill(0x75aadb), 0xffffff, ...new Array(4).fill(0x000000), 0xffffff, ...new Array(9).fill(0x75aadb)],
	bulgaria: [0xffffff, 0x00966e, 0xd62612],
	ivory: [0xff8200, 0xffffff, 0x009a44],
	estonia: [0x0072ce, 0x000000, 0xffffff],
	france: [0x0050a4, 0xffffff, 0xef4135],
	gabon: [0x009639, 0xffd100, 0x003da5],
	gambia: [...new Array(5).fill(0xce1126), 0xffffff, ...new Array(3).fill(0x0c1c8c), 0xffffff, ...new Array(5).fill(0x3a7728)],
	germany: [0x000000, 0xdd0000, 0xffcc00],
	guinea: [0xce1126, 0xfcd116, 0x009460],
	hungary: [0xc8102e, 0xffffff, 0x00843d],
	indonesia: [0xff0000, 0xffffff],
	ireland: [0x169b62, 0xffffff, 0xff883e],
	italy: [0x008c45, 0xf4f5f0, 0xcd212a],
	luxembourg: [0xf6343f, 0xffffff, 0x00a2e1],
	monaco: [0xce1126, 0xffffff],
	nigeria: [0x008751, 0xffffff, 0x008751],
	poland: [0xffffff, 0xdc143c],
	russia: [0xffffff, 0x0033a0, 0xda291c],
	romania: [0x002b7f, 0xfcd116, 0xce1126],
	sierraleone: [0x1eb53a, 0xffffff, 0x0072c6],
	thailand: [0xa51931, 0xf4f5f8, 0x2d2a4a, 0x2d2a4a, 0xf4f5f8, 0xa51931],
	ukraine: [0x005bbb, 0xffd500],
	yemen: [0xce1126, 0xffffff, 0x000000]
};

const VERTICAL_STRIPES = [
	COLORS.belgium, COLORS.france, COLORS.guinea, COLORS.ireland, COLORS.italy, COLORS.nigeria, COLORS.romania
];

const COLOR_KEYS = Object.keys(COLORS);

class Flag extends ImageController {
	constructor(router) {
		super(router, '/flag/{flag}');
	}

	/**
	 * @api {post} /flag/:flag Flag
	 * @apiGroup Image Manipulation
	 * @apiDescription Overlays the given flag onto the given image
	 *
	 * @apiParam (Path Arguments) {string=	"asexual","aromantic","bisexual","pansexual","gay","lesbian","trans",
	 * 										"nonbinary","genderfluid","genderqueer","polysexual",
	 * 										"austria","belgium","botswana","bulgaria","ivory","estonia","france",
	 * 										"gabon","gambia","germany","guinea","hungary","indonesia","ireland","italy",
	 * 										"luxembourg","monaco","nigeria","poland","russia","romania","sierraleone",
	 * 										"thailand","ukraine","yemen"} [flag="gay"] The flag to overlay
	 * @apiParam (Request Parameters) {number=64..192} [opacity=128] What opacity to overlay the flag with
	 *
	 * @apiUse ReturnsImage
	 * @apiUse RequiresImage
	 * @apiUse BadRequest
	 * @apiUse Unauthorized
	 */
	async post(context) {
		if (!context.application)
			return context.unauthorized();

		const flag = context.path.get('flag') ?? 'gay';
		if (!COLOR_KEYS.includes(flag))
			return context.badRequest('INVALID_FLAG');

		let opacity = context.parameters.get('opacity') ?? 128;
		if (isNaN(opacity) || opacity < 64 || opacity > 192)
			return context.badRequest('INVALID_OPACITY');
		opacity = parseInt(opacity);

		let image;
		try {
			[image] = await this.loadImagesFromContext(context, 1, 1, Infinity);
		} catch (err) {
			return context.badRequest(err);
		}

		if (image instanceof Image)
			image = [image];

		let overlay;
		if (COLOR_KEYS.includes(flag)) {
			const colors = COLORS[flag];
			const vertical = VERTICAL_STRIPES.includes(colors);

			overlay = new Image(vertical ? colors.length : 1, vertical ? 1 : colors.length);
			for (let i = 0; i < colors.length; i++)
				overlay.setPixelAt((vertical ? i : 0) + 1, (vertical ? 0 : i) + 1, colors[i] << 8 | opacity);
		}

		for (const frame of image) {
			if (overlay.width !== frame.width || overlay.height !== frame.height)
				overlay.resize(frame.width, frame.height);
			frame.composite(overlay);
		}

		return context.okImage(image);
	}
}

module.exports = Flag;
