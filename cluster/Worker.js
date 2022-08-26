const Logger = require('../util/log/Logger');
const HTTPHandler = require('../util/http/Handler');
const TaskScheduler = require('../util/scheduler/Scheduler');
const {DatabaseHandler} = require('../util/database/Handler');
const ConfigManager = require('../util/config/Manager');
const Mailer = require('../util/mail/Mailer');

class Worker {
	static async run() {
		this.config = new ConfigManager();
		new HTTPHandler();
		new TaskScheduler(DatabaseHandler, new Mailer(this.config.mail));
		setInterval(() => process.send({type: 'watchdog'}), 1000);
		Logger.success(`Running!`);
	}
}

module.exports = Worker;
