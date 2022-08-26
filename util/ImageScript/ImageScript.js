const fs = require('fs/promises');
const imported = require('imagescript');

module.exports = {
	/**
	 * @param {string} path
	 * @returns {Promise<Image>}
	 */
	async loadImage(path) {
		const binary = await fs.readFile(path);
		return await imported.Image.decode(binary);
	},
	...imported
};
