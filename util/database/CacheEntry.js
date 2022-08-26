const {Model} = require('./Model');
const CacheHandler = require('./Cache');

// noinspection JSCheckFunctionSignatures,JSUnusedGlobalSymbols
class CacheEntry extends Model {
	constructor(data) {
		super(data);
	}

	get __key__() {
		const primaryKeys = Object.keys(this.constructor.model).filter(key => this.constructor.model[key].primaryKey);
		if (!primaryKeys.length)
			throw new Error('Model has no primary key');
		return `${this.constructor.table}:${primaryKeys.map(key => this[key]).join(':')}`;
	}

	async create(expiresIn) {
		await CacheHandler.set(this.__key__, Object.assign({}, this), expiresIn);
		return this;
	}

	async set(expiresIn) {
		return await this.create(expiresIn);
	}

	async update(data, expiresIn) {
		const clone = new this.constructor(this);
		for (const [key, value] of data)
			if (clone.constructor.model[key])
				clone[key] = value;
		return await clone.create(expiresIn);
	}

	async delete() {
		await CacheHandler.set(this.__key__, null, 0);
		return this;
	}

	static async find(id) {
		const data = await CacheHandler.get(`${this.table}:${id}`);
		if (!data)
			return null;
		return new this(data);
	}

	list() {
		throw new Error('CacheEntry.list is unsupported');
	}
}

module.exports = CacheEntry;
