const {EPOCH} = require('./Constants');

class Snowflake {
	static toDate(snowflake, asTimestamp = false) {
		const timestamp = Number(BigInt(snowflake) >> 16n) + EPOCH;
		if (asTimestamp)
			return timestamp;
		return new Date(timestamp);
	}

	static fromTimestamp(timestamp, max = false) {
		if (typeof timestamp === 'string')
			timestamp = new Date(timestamp);
		if (timestamp instanceof Date)
			timestamp = timestamp.valueOf();
		let snowflakeBigint = BigInt(timestamp - EPOCH) << 16n;
		if (max)
			snowflakeBigint |= 0xffffn;
		return snowflakeBigint.toString();
	}
}

module.exports = Snowflake;
