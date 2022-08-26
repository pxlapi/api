const fs = require('fs');
const path = require('path');

/** @type {ConfigManager|undefined} */
let instance;

/**
 * @property {object} mail
 * @property {object} database
 * @property {object} cache
 * @property {object} captcha
 * @property {object} discord
 * @property {object} stripe
 */
class ConfigManager {
	constructor(configPath = './config/') {
		this.index(configPath);
		this.index(path.resolve(configPath, process.env.NODE_ENV));

		instance = this;
	}

	index(directory) {
		for (const entry of fs.readdirSync(directory)) {
			const resolved = path.resolve(directory, entry);
			if (fs.lstatSync(resolved).isDirectory())
				continue;

			this[entry.split('.')[0]] = require(resolved);
		}
	}

	static get current() {
		return instance;
	}
}

module.exports = ConfigManager;
