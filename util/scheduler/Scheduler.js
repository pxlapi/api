const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const Logger = require('../log/Logger');

class TaskScheduler {
	constructor(databaseConnector, mailer) {
		for (const fileName of fs.readdirSync('./tasks')) {
			const task = require(path.resolve(path.join('./tasks', fileName)));
			if (!task.runOnMaster && cluster.isMaster)
				continue;
			if (!task.runOnWorker && cluster.isWorker)
				continue;

			void this.scheduleTask(task, databaseConnector, mailer);
		}
	}

	// noinspection InfiniteRecursionJS
	async scheduleTask(task, databaseConnector, mailer) {
		let runOffset = task.nextRun - Date.now();
		Logger.info(`Task ${task.constructor.name} will run on ${task.runOnMaster ? 'master' : 'workers'} in ${TaskScheduler.format(runOffset)}`);
		while (runOffset >= 2 ** 30) {
			await new Promise(r => setTimeout(r, 2 ** 30));
			runOffset = task.nextRun - Date.now();
		}

		await new Promise(r => setTimeout(r, runOffset));
		await task.run(databaseConnector, mailer);
		await this.scheduleTask(task, databaseConnector, mailer);
	}

	static format(time) {
		time = Math.round(time / 1000) * 1000;

		const days = Math.floor(time / 1000 / 60 / 60 / 24);
		time -= days * 1000 * 60 * 60 * 24;
		const hours = Math.floor(time / 1000 / 60 / 60);
		time -= hours * 1000 * 60 * 60;
		const minutes = Math.floor(time / 1000 / 60);
		time -= minutes * 1000 * 60;
		const seconds = Math.round(time / 1000);

		let timeString = '';
		if (days)
			timeString += `${days}d `;
		if (hours)
			timeString += `${hours}h `;
		if (minutes)
			timeString += `${minutes}m `;
		if (seconds)
			timeString += `${seconds}s`;

		return timeString.trim();
	}
}

module.exports = TaskScheduler;
