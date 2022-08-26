/** @type {Map<string, {ext: string, mime: string}>} */
const types = new Map([
	['png', {ext: 'png', mime: 'image/png'}],
	['gif', {ext: 'gif', mime: 'image/gif'}],
	['bmp', {ext: 'bmp', mime: 'image/bmp'}],
	['ogg', {ext: 'ogg', mime: 'audio/ogg'}],
	['m4a', {ext: 'm4a', mime: 'audio/m4a'}],
	['amr', {ext: 'amr', mime: 'audio/amr'}],
	['mp4', {ext: 'mp4', mime: 'video/mp4'}],
	['jpg', {ext: 'jpg', mime: 'image/jpeg'}],
	['mp3', {ext: 'mp3', mime: 'audio/mpeg'}],
	['tif', {ext: 'tif', mime: 'image/tiff'}],
	['mid', {ext: 'mid', mime: 'audio/midi'}],
	['mpg', {ext: 'mpg', mime: 'video/mpeg'}],
	['m4v', {ext: 'm4v', mime: 'video/x-m4v'}],
	['flv', {ext: 'flv', mime: 'video/x-flv'}],
	['wav', {ext: 'wav', mime: 'audio/x-wav'}],
	['ico', {ext: 'ico', mime: 'image/x-icon'}],
	['webp', {ext: 'webp', mime: 'image/webp'}],
	['flif', {ext: 'flif', mime: 'image/flif'}],
	['webm', {ext: 'webm', mime: 'video/webm'}],
	['opus', {ext: 'opus', mime: 'audio/opus'}],
	['gz', {ext: 'gz', mime: 'application/gzip'}],
	['xz', {ext: 'xz', mime: 'application/x-xz'}],
	['wmv', {ext: 'wmv', mime: 'video/x-ms-wmv'}],
	['flac', {ext: 'flac', mime: 'audio/x-flac'}],
	['avi', {ext: 'avi', mime: 'video/x-msvideo'}],
	['zip', {ext: 'zip', mime: 'application/zip'}],
	['rtf', {ext: 'rtf', mime: 'application/rtf'}],
	['pdf', {ext: 'pdf', mime: 'application/pdf'}],
	['mxf', {ext: 'mxf', mime: 'application/mxf'}],
	['mov', {ext: 'mov', mime: 'video/quicktime'}],
	['lz', {ext: 'lz', mime: 'application/x-lzip'}],
	['mkv', {ext: 'mkv', mime: 'video/x-matroska'}],
	['tar', {ext: 'tar', mime: 'application/x-tar'}],
	['rpm', {ext: 'rpm', mime: 'application/x-rpm'}],
	['cr2', {ext: 'cr2', mime: 'image/x-canon-cr2'}],
	['msi', {ext: 'msi', mime: 'application/x-msi'}],
	['deb', {ext: 'deb', mime: 'application/x-deb'}],
	['Z', {ext: 'Z', mime: 'application/x-compress'}],
	['jxr', {ext: 'jxr', mime: 'image/vnd.ms-photo'}],
	['bz2', {ext: 'bz2', mime: 'application/x-bzip2'}],
	['ps', {ext: 'ps', mime: 'application/postscript'}],
	['ttf', {ext: 'ttf', mime: 'application/font-sfnt'}],
	['otf', {ext: 'otf', mime: 'application/font-sfnt'}],
	['epub', {ext: 'epub', mime: 'application/epub+zip'}],
	['woff', {ext: 'woff', mime: 'application/font-woff'}],
	['xpi', {ext: 'xpi', mime: 'application/x-xpinstall'}],
	['ar', {ext: 'ar', mime: 'application/x-unix-archive'}],
	['exe', {ext: 'exe', mime: 'application/x-msdownload'}],
	['eot', {ext: 'eot', mime: 'application/octet-stream'}],
	['7z', {ext: '7z', mime: 'application/x-7z-compressed'}],
	['psd', {ext: 'psd', mime: 'image/vnd.adobe.photoshop'}],
	['woff2', {ext: 'woff2', mime: 'application/font-woff'}],
	['sqlite', {ext: 'sqlite', mime: 'application/x-sqlite3'}],
	['rar', {ext: 'rar', mime: 'application/x-rar-compressed'}],
	['swf', {ext: 'swf', mime: 'application/x-shockwave-flash'}],
	['dmg', {ext: 'dmg', mime: 'application/x-apple-diskimage'}],
	['nes', {ext: 'nes', mime: 'application/x-nintendo-nes-rom'}],
	['cab', {ext: 'cab', mime: 'application/vnd.ms-cab-compressed'}],
	['crx', {ext: 'crx', mime: 'application/x-google-chrome-extension'}]
]);

const __webm__ = [...'webm'];
const __matroska__ = [...'matroska'];

class MIMEDetector {
	/**
	 * @param {Buffer} input
	 * @return {{ext: string, mime: string}|null}
	 */
	static detect(input) {
		const buf = new Uint8Array(input);
		if (buf.length === 0) return null;

		if (buf[0] === 0x78 && buf[1] === 0x01) return types.get('dmg');
		if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return types.get('gif');
		if (buf[0] === 0x4E && buf[1] === 0x45 && buf[2] === 0x53 && buf[3] === 0x1A) types.get('nes');
		if (buf[0] === 0x4C && buf[1] === 0x5A && buf[2] === 0x49 && buf[3] === 0x50) return types.get('lz');
		if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return types.get('png');
		if (buf[0] === 0x38 && buf[1] === 0x42 && buf[2] === 0x50 && buf[3] === 0x53) return types.get('psd');
		if (buf[0] === 0xED && buf[1] === 0xAB && buf[2] === 0xEE && buf[3] === 0xDB) return types.get('rpm');
		if (buf[0] === 0x33 && buf[1] === 0x67 && buf[2] === 0x70 && buf[3] === 0x35) return types.get('mp4');
		if (buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43) return types.get('flac');
		if (buf[0] === 0x53 && buf[1] === 0x51 && buf[2] === 0x4C && buf[3] === 0x69) return types.get('sqlite');
		if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return types.get('webp');
		if (buf[0] === 0x7B && buf[1] === 0x5C && buf[2] === 0x72 && buf[3] === 0x74 && buf[4] === 0x66) return types.get('rtf');
		if (buf[257] === 0x75 && buf[258] === 0x73 && buf[259] === 0x74 && buf[260] === 0x61 && buf[261] === 0x72) return types.get('tar');
		if (buf[0] === 0x37 && buf[1] === 0x7A && buf[2] === 0xBC && buf[3] === 0xAF && buf[4] === 0x27 && buf[5] === 0x1C) return types.get('7z');
		if (buf[0] === 0xFD && buf[1] === 0x37 && buf[2] === 0x7A && buf[3] === 0x58 && buf[4] === 0x5A && buf[5] === 0x00) return types.get('xz');
		if (buf[0] === 0x23 && buf[1] === 0x21 && buf[2] === 0x41 && buf[3] === 0x4D && buf[4] === 0x52 && buf[5] === 0x0A) return types.get('amr');
		if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70 && buf[8] === 0x4D && buf[9] === 0x34 && buf[10] === 0x41) return types.get('m4a');
		if (buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0 && buf[4] === 0xA1 && buf[5] === 0xB1 && buf[6] === 0x1A && buf[7] === 0xE1) return types.get('msi');
		if (buf[28] === 0x4F && buf[29] === 0x70 && buf[30] === 0x75 && buf[31] === 0x73 && buf[32] === 0x48 && buf[33] === 0x65 && buf[34] === 0x61 && buf[35] === 0x64) return types.get('opus');
		if (buf[34] === 0x4C && buf[35] === 0x50 && buf[9] === 0x00 && ((buf[8] === 0x00 && buf[10] === 0x01) || (buf[10] === 0x02 && (buf[8] === 0x01 || buf[8] === 0x02)))) return types.get('eot');
		if (buf[0] === 0x30 && buf[1] === 0x26 && buf[2] === 0xB2 && buf[3] === 0x75 && buf[4] === 0x8E && buf[5] === 0x66 && buf[6] === 0xCF && buf[7] === 0x11 && buf[8] === 0xA6 && buf[9] === 0xD9) return types.get('wmv');
		if (buf[0] === 0x06 && buf[1] === 0x0E && buf[2] === 0x2B && buf[3] === 0x34 && buf[4] === 0x02 && buf[5] === 0x05 && buf[6] === 0x01 && buf[7] === 0x01 && buf[8] === 0x0D && buf[9] === 0x01 && buf[10] === 0x02 && buf[11] === 0x01 && buf[12] === 0x01 && buf[13] === 0x02) return types.get('mxf');

		if (buf[0] === 0xFF) {
			if (buf[1] === 0xfb) return types.get('mp3');
			if (buf[1] === 0xD8 && buf[2] === 0xFF) return types.get('jpg');
		}

		if (buf[0] === 0x42) {
			if (buf[1] === 0x4D) return types.get('bmp');
			if (buf[1] === 0x5A && buf[2] === 0x68) return types.get('bz2');
		}

		if (buf[0] === 0x1F) {
			if (buf[1] === 0x8B && buf[2] === 0x8) return types.get('gz');
			if (buf[1] === 0xA0 || buf[1] === 0x9D) return types.get('Z');
		}

		if (buf[0] === 0x25) {
			if (buf[1] === 0x21) return types.get('ps');
			if (buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return types.get('pdf');
		}

		if (buf[0] === 0x00) {
			if (buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return types.get('ico');
			if (buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00 && buf[4] === 0x00) return types.get('ttf');
		}

		if (buf[0] === 0x43) {
			if (buf[1] === 0x57 && buf[2] === 0x53) return types.get('swf');
			if (buf[1] === 0x72 && buf[2] === 0x32 && buf[3] === 0x34) return types.get('crx');
		}

		if (buf[0] === 0x4F) {
			if (buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return types.get('ogg');
			if (buf[1] === 0x54 && buf[2] === 0x54 && buf[3] === 0x4F && buf[4] === 0x00) return types.get('otf');
		}

		if (buf[0] === 0x46) {
			if (buf[1] === 0x57 && buf[2] === 0x53) return types.get('swf');
			if (buf[1] === 0x4C && buf[2] === 0x56 && buf[3] === 0x01) return types.get('flv');
			if (buf[1] === 0x4C && buf[2] === 0x49 && buf[3] === 0x46) return types.get('flif');
		}

		if (buf[0] === 0x52) {
			if (buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49) return types.get('avi');
			if (buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21 && buf[4] === 0x1A && buf[5] === 0x7 && (buf[6] === 0x0 || buf[6] === 0x1)) return types.get('rar');
			if (buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) return types.get('wav');
		}

		if (
			buf[0] === 0x77 && buf[1] === 0x4F && buf[2] === 0x46
			&& (
				(buf[4] === 0x00 && buf[5] === 0x01 && buf[6] === 0x00 && buf[7] === 0x00)
				|| (buf[4] === 0x4F && buf[5] === 0x54 && buf[6] === 0x54 && buf[7] === 0x4F)
			)
		) {
			if (buf[3] === 0x46) return types.get('woff');
			if (buf[3] === 0x32) return types.get('woff2');
		}

		if (buf[0] === 0x21 && buf[1] === 0x3C && buf[2] === 0x61 && buf[3] === 0x72 && buf[4] === 0x63 && buf[5] === 0x68 && buf[6] === 0x3E) {
			if (buf[7] === 0x0A && buf[8] === 0x64 && buf[9] === 0x65 && buf[10] === 0x62
				&& buf[11] === 0x69 && buf[12] === 0x61 && buf[13] === 0x6E && buf[14] === 0x2D
				&& buf[15] === 0x62 && buf[16] === 0x69 && buf[17] === 0x6E && buf[18] === 0x61
				&& buf[19] === 0x72 && buf[20] === 0x79
			) return types.get('deb');

			return types.get('ar');
		}

		if (buf[0] === 0x4D) {
			if (buf[1] === 0x5A) return types.get('exe');
			if (buf[1] === 0x34 && buf[2] === 0x41 && buf[3] === 0x20) return types.get('m4a');
			if (buf[1] === 0x53 && buf[2] === 0x43 && buf[3] === 0x46) return types.get('cab');
			if (buf[1] === 0x54 && buf[2] === 0x68 && buf[3] === 0x64) return types.get('mid');

			if (buf[1] === 0x4D && buf[2] === 0x0 && buf[3] === 0x2A) {
				if (buf[8] === 0x43 && buf[9] === 0x52) return types.get('cr2');

				return types.get('tif');
			}
		}

		if (buf[0] === 0x49) {
			if (buf[1] === 0x44 && buf[2] === 0x33) return types.get('mp3');
			if (buf[1] === 0x53 && buf[2] === 0x63 && buf[3] === 0x28) return types.get('cab');

			if (buf[1] === 0x49) {
				if (buf[2] === 0xBC) return types.get('jxr');

				if (buf[2] === 0x2A && buf[3] === 0x0) {
					if (buf[8] === 0x43 && buf[9] === 0x52) return types.get('cr2');

					return types.get('tif');
				}
			}
		}

		if (buf[0] === 0x50 && buf[1] === 0x4B) {
			if (buf[2] === 0x3 && buf[3] === 0x4) {
				if (
					buf[30] === 0x4D && buf[31] === 0x45 && buf[32] === 0x54 && buf[33] === 0x41
					&& buf[34] === 0x2D && buf[35] === 0x49 && buf[36] === 0x4E && buf[37] === 0x46
					&& buf[38] === 0x2F && buf[39] === 0x6D && buf[40] === 0x6F && buf[41] === 0x7A
					&& buf[42] === 0x69 && buf[43] === 0x6C && buf[44] === 0x6C && buf[45] === 0x61
					&& buf[46] === 0x2E && buf[47] === 0x72 && buf[48] === 0x73 && buf[49] === 0x61
				) return types.get('xpi');

				if (
					buf[30] === 0x6D && buf[31] === 0x69 && buf[32] === 0x6D && buf[33] === 0x65
					&& buf[34] === 0x74 && buf[35] === 0x79 && buf[36] === 0x70 && buf[37] === 0x65
					&& buf[38] === 0x61 && buf[39] === 0x70 && buf[40] === 0x70 && buf[41] === 0x6C
					&& buf[42] === 0x69 && buf[43] === 0x63 && buf[44] === 0x61 && buf[45] === 0x74
					&& buf[46] === 0x69 && buf[47] === 0x6F && buf[48] === 0x6E && buf[49] === 0x2F
					&& buf[50] === 0x65 && buf[51] === 0x70 && buf[52] === 0x75 && buf[53] === 0x62
					&& buf[54] === 0x2B && buf[55] === 0x7A && buf[56] === 0x69 && buf[57] === 0x70
				) return types.get('epub');

				return types.get('zip');
			}

			if ((buf[2] === 0x5 || buf[2] === 0x7) && (buf[3] === 0x6 || buf[3] === 0x8)) return types.get('zip');
		}

		if (buf[0] === 0x0 && buf[1] === 0x0) {
			if (buf[2] === 0x1 && buf[3].toString(16)[0] === 'b') return types.get('mpg');

			if (buf[2] === 0x0 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
				if (buf[3] === 0x14) return types.get('mov');
				if (buf[3] === 0x1C && buf[8] === 0x4D && buf[9] === 0x34 && buf[10] === 0x56) return types.get('m4v');

				if (
					(buf[3] === 0x18 || buf[3] === 0x20)
					|| (buf[3] === 0x1C && buf[8] === 0x69 && buf[9] === 0x73 && buf[10] === 0x6F && buf[11] === 0x6D)
					|| (
						buf[8] === 0x6D && buf[9] === 0x70 && buf[10] === 0x34 && buf[11] === 0x32
						&& (
							(buf[3] === 0x1c && buf[12] === 0x0 && buf[13] === 0x0 && buf[14] === 0x0 && buf[15] === 0x0)
							|| (
								buf[3] === 0x1C && buf[16] === 0x6D && buf[17] === 0x70 && buf[18] === 0x34
								&& buf[19] === 0x31 && buf[20] === 0x6D && buf[21] === 0x70 && buf[22] === 0x34
								&& buf[23] === 0x32 && buf[24] === 0x69 && buf[25] === 0x73 && buf[26] === 0x6F
								&& buf[27] === 0x6D
							)
						)
					)
				) return types.get('mp4');
			}
		}

		if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
			const slice = buf.subarray(4, 5000);
			const pos = slice.findIndex(MIMEDetector.__mwfia__);

			if (pos >= 0) {
				if (MIMEDetector.__fdt__(3 + pos, __webm__, slice)) return types.get('webm');
				if (MIMEDetector.__fdt__(3 + pos, __matroska__, slice)) return types.get('mkv');
			}
		}

		return null;
	}

	static __mwfia__(_, i, arr) {
		return arr[i] === 0x42 && arr[1 + i] === 0x82;
	}

	static __fdt__(dp, type, slice) {
		return type.every((c, i) => slice[dp + i] === c.charCodeAt(0));
	}
}

module.exports = MIMEDetector;
