const CacheEntry = require('../../util/database/CacheEntry');

class ImageScriptResource extends CacheEntry {
	static get table() {
		return 'ISaaS';
	}

	static get model() {
		return {
			url: {
				primaryKey: true
			},
			body: {}
		};
	}
}

module.exports = ImageScriptResource;
