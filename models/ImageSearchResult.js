const {Model} = require('../util/database/Model');

/**
 * @property {string} hash
 * @property {object[]} data
 */
class ImageSearchResult extends Model {
	static get table() {
		return 'image_search_cache';
	}

	static get model() {
		return {
			id: {
				type: 'SNOWFLAKE'
			},
			query: {
				type: 'VARCHAR(128)',
				notNull: true
			},
			safe_search: {
				type: 'SMALLINT'
			},
			url: {
				type: 'TEXT',
				notNull: true
			},
			title: {
				type: 'TEXT',
				notNull: true
			},
			location: {
				type: 'TEXT',
				notNull: true
			}
		};
	}
}

module.exports = ImageSearchResult;
