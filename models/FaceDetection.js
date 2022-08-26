const {Model} = require('../util/database/Model');

/**
 * @property {string} hash
 * @property {object[]} faces
 */
class FaceDetectionCacheEntry extends Model {
	static get table() {
		return 'face_detection_cache';
	}

	static get model() {
		return {
			id: {
				type: 'SNOWFLAKE'
			},
			hash: {
				type: 'VARCHAR(32)',
				primaryKey: true
			},
			time_taken: {
				type: 'INTERVAL',
				notNull: true
			},
			faces: {
				type: 'JSONB',
				notNull: true
			}
		};
	}
}

module.exports = FaceDetectionCacheEntry;
