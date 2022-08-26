const {DatabaseHandler} = require('./Handler');

const filterSuffixes = {
	'gt': '>',
	'lt': '<',
	'ge': '>=',
	'le': '<=',
	'ba': '& $$ =',
	'nn': 'IS NOT NULL'
};

class Model {
	/**
	 * @typedef {object} ModelColumn
	 * @property {string} type
	 * @property {boolean} [notNull=false]
	 * @property {boolean} [unique=false]
	 * @property {boolean} [hide=false]
	 * @property {function} validate?
	 * @property {*} default?
	 */

	/**
	 *
	 * @returns {object<string, ModelColumn>}
	 */
	static get model() {
		return {};
	}

	static get table() {
		return '';
	}

	static get name() {
		return '';
	}

	constructor(data = {}) {
		for (const key of Object.keys(this.constructor.model))
			this[key] = data[key];
	}

	static buildQuery() {
		const columnNames = Object.keys(this.model);

		const primaryKeys = [];

		const columns = columnNames.map(columnName => {
			const column = this.model[columnName];
			const parameters = [];

			if (column.primaryKey || column.type === 'SNOWFLAKE')
				primaryKeys.push(columnName);

			if (column.notNull) parameters.push('NOT NULL');
			if (column.default !== undefined) parameters.push(`DEFAULT ${typeof column.default === 'string' ? `'${column.default}'` : column.default}`);
			if (column.unique) parameters.push('UNIQUE');

			return `${columnName} ${column.type}${parameters.length ? ` ${parameters.join(' ')}` : ''}`;
		});

		return `CREATE TABLE ${this.table} (${columns.join(', ')}${primaryKeys.length ? `, PRIMARY KEY(${primaryKeys.join(', ')})` : ''})`;
	}

	/**
	 * Returns a JSON friendly version of the model
	 * @param {string[]} filter Model properties to exclude
	 * @returns {object} The API response
	 */
	toAPIResponse(filter = []) {
		const response = {};

		for (const key of Object.keys(this.constructor.model)) {
			if (this.constructor.model[key].hide || filter.includes(key))
				continue;
			response[key] = this[key];
		}

		return response;
	}

	/**
	 * Writes the model to the database
	 * @param {Transaction} [transaction}
	 * @returns {Promise<Model>} The model created
	 */
	async create(transaction) {
		const data = {};

		// noinspection JSCheckFunctionSignatures
		for (const key of Object.keys(this.constructor.model)) {
			const value = this[key];
			if (value === undefined)
				continue;
			data[key] = ['JSON', 'JSONB'].includes(this.constructor.model[key].type.toUpperCase()) ? JSON.stringify(value) : value;
		}

		for (const key of Object.keys(this.constructor.model)) {
			if (this.constructor.model[key].validate)
				if (!this.constructor.model[key].validate.call(this, data[key]))
					throw new InvalidModelError(`INVALID_${key.toUpperCase()}`);
		}

		const dbReturn = await (transaction ?? DatabaseHandler).query(
			`INSERT INTO ${
				this.constructor.table
			}(${
				Object.keys(data).join(', ')
			}) VALUES (${
				[...Array(Object.keys(data).length).keys()].map(index => `$${index + 1}`).join(', ')
			}) RETURNING *`,
			Object.values(data)
		);

		const result = {};
		for (const [column, value] of Object.entries(dbReturn.rows[0]))
			result[column] = value;

		return new this.constructor(result);
	}

	/**
	 * Updates the Model
	 * @param {object} payload The keys to update
	 * @param {Transaction} [transaction}
	 * @returns {Promise<Model>} The model deleted
	 */
	async update(payload, transaction) {
		const data = {};
		const payloadKeys = Object.keys(payload);
		const primaryKeys = [];

		for (const [key, column] of Object.entries(this.constructor.model)) {
			if (column.primaryKey || column.type === 'SNOWFLAKE')
				primaryKeys.push(key);
			if (!payloadKeys.includes(key))
				continue;

			if (this.constructor.model[key].validate)
				if (!this.constructor.model[key].validate.call(this, payload[key]))
					throw new InvalidModelError(`INVALID_${key.toUpperCase()}`);

			data[key] = payload[key];
		}

		const dataKeys = Object.keys(data);
		const where = [];
		const set = [];

		for (let i = 0; i < primaryKeys.length; i++)
			where.push(`${primaryKeys[i]} = $${i + 1}`);

		for (let i = 0; i < dataKeys.length; i++)
			set.push(`${dataKeys[i]} = $${i + primaryKeys.length + 1}`);

		const result = await (transaction ?? DatabaseHandler).query(
			`UPDATE ${this.constructor.table} SET ${set.join(', ')} WHERE ${where.join(' AND ')} RETURNING *`,
			[...primaryKeys.map(key => this[key]), ...Object.values(data)]
		);

		return new this.constructor(result.rows[0]);
	}

	/**
	 * Deletes the Model
	 * @param {Transaction} [transaction}
	 * @returns {Promise<Model>} The model deleted
	 */
	async delete(transaction) {
		const primaryKeys = [];

		for (const key of Object.keys(this)) {
			const column = this.constructor.model[key];

			if (column.primaryKey || column.type === 'SNOWFLAKE')
				primaryKeys.push(key);
		}

		const where = [];

		for (let i = 0; i < primaryKeys.length; i++)
			where.push(`${primaryKeys[i]} = $${i + 1}`);

		const result = await (transaction ?? DatabaseHandler).query(
			`DELETE FROM ${this.constructor.table} WHERE ${where.join(' AND ')} RETURNING *`,
			[...primaryKeys.map(key => this[key])]
		);

		return new this.constructor(result.rows[0]);
	}

	/**
	 * Returns a single Model matching the filter
	 * @param {Object} filter The filter to apply
	 * @returns {Promise<Model|null>} The model matching the filter
	 */
	static async find(filter) {
		/**
		 * @type {Model[]}
		 */
		const results = await this.list(filter);
		if (!results.length)
			return null;
		if (results.length > 1)
			throw new Error('Multiple models found in Model#find (use Model#list instead?)');
		return results[0];
	}

	/**
	 * Returns zero or more Models matching the filter
	 * @param {object} filter The filter to apply
	 * @param {Transaction} [transaction}
	 * @param {number} [limit]
	 * @param {object} [order]
	 * @returns {Promise<ModelList>} A list of models matching the filter
	 */
	static async list(filter = {}, transaction, {limit, order} = {}) {
		if (limit <= 0)
			return new ModelList(this, []);

		const filters = {};
		let filterCount = 0;
		{
			const originalFilterKeys = Object.keys(filter);
			const originalFilterValues = Object.values(filter);

			for (let i = 0; i < originalFilterKeys.length; i++) {
				if (originalFilterValues[i] === undefined)
					continue;

				let keyName = originalFilterKeys[i];
				let comparison = '=';
				if (keyName[keyName.length - 3] === '_' && filterSuffixes[keyName.substr(-2)]) {
					comparison = filterSuffixes[keyName.substr(-2)];
					keyName = keyName.substring(0, keyName.length - 3);
				}

				const isArray = Array.isArray(originalFilterValues[i]);
				if (isArray && !originalFilterValues[i].length)
					return new ModelList(this, []);

				filterCount++;
				let filterComparison;
				if (isArray)
					filterComparison = `= ANY($${filterCount}::${this.model[keyName].type}[])`;
				else if (comparison === 'IS NOT NULL') {
					filterComparison = comparison;
					filterCount--;
				} else
					filterComparison = `${comparison.replace('$$', `$${filterCount}`)} $${filterCount}`;

				filters[`${keyName} ${filterComparison}`] = originalFilterValues[i];
			}
		}

		const filterKeys = [];
		const filterValues = [];

		for (const [key, value] of Object.entries(filters)) {
			filterKeys.push(key);
			if (key.endsWith('IS NOT NULL'))
				continue;
			filterValues.push(value);
		}

		const result = await (transaction ?? DatabaseHandler).query(
			`SELECT * FROM ${
				this.table
			}${
				filterKeys.length ? ` WHERE ${filterKeys.join(' AND ')}` : ''
			}${
				order ? ` ORDER BY ${Object.entries(order).map(([col, dir]) => `${col} ${dir}`).join(', ')}` : ''
			}${
				limit ? ` LIMIT $${filterValues.length + 1}` : ''
			}`,
			limit ? [...filterValues, limit] : filterValues
		);

		return new ModelList(this, result.rows);
	}

	static get invalid() {
		return new InvalidModelError(`INVALID_${this.name.replace(/([a-z])([A-Z])/g, (match, a, b) => `${a}_${b}`).toUpperCase()}`);
	}

	static get InvalidModelError() {
		return InvalidModelError;
	}
}

class ModelList extends Array {

	/**
	 * Returns an array of models
	 * @param {typeof Model} ModelType Type of the model
	 * @param {object[]} modelData Array of model data
	 */
	constructor(ModelType, modelData) {
		super(modelData.length);
		for (let i = 0; i < modelData.length; i++)
			this[i] = new ModelType(modelData[i]);
	}

	/**
	 * Returns a JSON friendly version of the model list
	 * @param {string[]} filter Model properties to exclude
	 */
	toAPIResponse(filter = []) {
		const models = [];
		for (const model of this)
			models.push(model.toAPIResponse(filter));

		return models;
	}

	map(callback) {
		const models = [];
		for (const model of this)
			models.push(callback(model));

		return models;
	}

}

class InvalidModelError extends Error {
	constructor(message) {
		super(message);
		this.name = 'InvalidModelError';
	}
}

module.exports = {Model, ModelList, InvalidModelError};
