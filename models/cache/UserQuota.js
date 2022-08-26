const CacheEntry = require('../../util/database/CacheEntry');

/**
 * @property {number} quotaUsed
 */
class UserQuota extends CacheEntry {
	static get table() {
		return 'userQuota';
	}

	static get model() {
		return {
			userID: {
				primaryKey: true
			},
			quotaUsed: {}
		};
	}
}

module.exports = UserQuota;
