const {Model} = require('../../util/database/Model');
const bcrypt = require('bcrypt');

/**
 * @property {string} id
 * @property {string} email_address
 * @property {string} display_name
 * @property {number} permissions_value
 * @property {string} password
 * @property {string|null} discord_id
 * @property {number|null} quota
 * @property {number} monthly_credits
 * @property {number} credits
 * @property {number|null} credit_alert
 */
class User extends Model {
	static get table() {
		return 'users';
	}

	static get model() {
		return {
			id: {
				type: 'SNOWFLAKE'
			},
			email_address: {
				type: 'VARCHAR(256)',
				notNull: true,
				unique: true,
				validate(value) {
					return typeof value === 'string' &&
						/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(value);
				}
			},
			display_name: {
				type: 'VARCHAR(64)',
				notNull: true,
				validate(value) {
					return typeof value === 'string' && value.length >= 3 && value.length <= 64;
				}
			},
			permissions_value: {
				type: 'SMALLINT',
				default: PermissionsHandler.from(User.permissionNames),
				notNull: true
			},
			password: {
				type: 'VARCHAR(60)',
				hide: true,
				validate(value) {
					if ([undefined, null].includes(value) && this.discord_id) return true;
					return typeof value === 'string' && value.length >= 8;
				}
			},
			quota: {
				type: 'INTEGER',
				validate(value) {
					return [undefined, null].includes(value) ? true : (value >= 0 && value <= 2 ** 31);
				}
			},
			monthly_credits: {
				type: 'INTEGER',
				notNull: true,
				default: 10000
			},
			credits: {
				type: 'INTEGER',
				notNull: true,
				default: 0
			},
			credit_alert: {
				type: 'INTEGER'
			},
			discord_id: {
				type: 'BIGINT'
			},
			updated_at: {
				type: 'TIMESTAMPTZ',
				notNull: true
			}
		};
	}

	/**
	 * @returns {PermissionsHandler}
	 */
	get permissions() {
		return new PermissionsHandler(User.permissionNames, this.permissions_value);
	}

	static get permissions() {
		return PermissionsHandler;
	}

	static get permissionNames() {
		return ['admin', 'verifiedEmail', 'active'];
	}

	static async hashPassword(plaintext) {
		return await bcrypt.hash(plaintext, 10);
	}

	static async comparePassword(hash, plaintext) {
		if (!hash || !plaintext)
			return false;
		return await bcrypt.compare(plaintext, hash);
	}

	static get invalidPassword() {
		return new Error('INVALID_PASSWORD');
	}

	static get duplicateEmail() {
		return new Error('DUPLICATE_EMAIL');
	}
}

/**
 * @property {boolean} admin
 * @property {boolean} verifiedEmail
 * @property {boolean} active
 */
class PermissionsHandler {
	constructor(availablePermissions, grantedPermissions) {
		this.grantedNames = [];

		for (const permission of availablePermissions) {
			const index = availablePermissions.indexOf(permission);
			const value = 2 ** index;

			this[permission] = (grantedPermissions & value) === value;
			if (this[permission])
				this.grantedNames.push(permission);
		}
	}

	static from(availablePermissions, grantedPermissions = []) {
		let value = 0;

		for (const name of grantedPermissions) {
			if (!availablePermissions.includes(name)) throw new Error(`Invalid permission name ${name}`);
			value += 2 ** availablePermissions.indexOf(name);
		}

		return value;
	}
}

module.exports = User;
