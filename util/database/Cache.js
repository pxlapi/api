class CacheHandler {
	static async get(key) {
		return await this.__send__('get', key);
	}

	static async set(key, value, expiresIn) {
		return await this.__send__('set', key, value, expiresIn);
	}

	static async publish(channel, data) {
		return await this.__send__('publish', channel, data);
	}

	static async __send__(action, key, value, expiresIn) {
		const nonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		const replyPromise = new Promise(resolve => {
			const messageListener = message => {
				if (message.nonce === nonce)
					return resolve(message);
				process.once('message', messageListener);
			};

			process.once('message', messageListener);
		});

		process.send({
			nonce,
			type: 'redis',
			action,
			key,
			value,
			expiresIn
		});

		const {result, error} = await replyPromise;
		if (error)
			throw new Error(result);
		return result;
	}
}

module.exports = CacheHandler;
