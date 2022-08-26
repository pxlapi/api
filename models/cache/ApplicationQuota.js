const CacheEntry = require('../../util/database/CacheEntry');

/**
 * @property {number} quotaUsed
 */
class ApplicationQuota extends CacheEntry {
	static get table() {
		return 'applicationQuota';
	}

	static get model() {
		return {
			applicationID: {
				primaryKey: true
			},
			quotaUsed: {}
		};
	}
}

module.exports = ApplicationQuota;
