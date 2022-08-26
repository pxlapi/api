const WebSocket = require('ws');
const Logger = require('../log/Logger');
const AuthorizationProvider = require('../authorization/AuthorizationProvider');
const {ModelList} = require('../database/Model');
const {Model} = require('../database/Model');

const HEARTBEAT_INTERVAL = 30000;
const CLOSE_CODES = {
	ABNORMAL: 4000
};

let instance;

class WSHandler {
	constructor(server) {
		this.server = new WebSocket.Server({server});
		this.server.on('connection', socket => this.handleConnection(socket));

		setInterval(() => {
			for (const client of this.server.clients)
				if (client.lastHeartbeat - Date.now() > HEARTBEAT_INTERVAL * 2)
					client.close(CLOSE_CODES.ABNORMAL, 'heartbeat timed out');
				else this.send(client, {type: 'ping'});
		}, HEARTBEAT_INTERVAL);

		process.on('message', msg => {
			const {type, data} = msg;
			if (type !== 'logs')
				return;

			const {user_id, application_id} = data;
			for (const client of this.server.clients) {
				if (client.auth?.userID !== user_id || client.intent?.type !== 'logs' || client.intent?.application !== application_id)
					continue;

				this.send(client, {type: 'log', data});
			}
		});

		instance = this;
	}

	handleConnection(client) {
		Logger.info(`WebSocket connected`);

		client.lastHeartbeat = Date.now();
		client.on('message', message => this.handleMessage(client, message));
		client.on('pong', () => client.lastHeartbeat = Date.now());
	}

	async handleMessage(client, message) {
		try {
			message = JSON.parse(message);
		} catch (err) {
			return client.close(CLOSE_CODES.ABNORMAL, 'failed deserializing');
		}

		const {type, data} = message;

		switch (type) {
			case 'auth': {
				const {token} = data;
				const {user, accessToken} = await AuthorizationProvider.from('User', token);
				if (!user)
					return client.close(CLOSE_CODES.ABNORMAL, 'invalid auth');

				client.auth = {userID: user.id, token: accessToken.token};
				this.send(client, {type: 'auth', data: user});
				Logger.info(`Websocket authenticated as ${user.email_address} (${user.id})`);
				break;
			}

			case 'intent': {
				const {type, application} = data;
				if (!['logs'].includes(type))
					return client.close(CLOSE_CODES.ABNORMAL, 'invalid intent');

				client.intent = {type, application};
				break;
			}

			case 'pong': {
				client.lastHeartbeat = Date.now();
				break;
			}

			default:
				client.close(CLOSE_CODES.ABNORMAL, 'invalid type');
		}
	}

	send(client, {type, data}) {
		let toSend;
		try {
			if ([Model, ModelList].some(parent => data instanceof parent))
				data = data.toAPIResponse();

			if (typeof data !== 'string')
				toSend = JSON.stringify({type, data});
		} catch (err) {
			Logger.error('Failed to serialize WS data');
			return client.close(CLOSE_CODES.ABNORMAL, 'failed serializing');
		}

		client.send(toSend);
	}
}

module.exports = WSHandler;
