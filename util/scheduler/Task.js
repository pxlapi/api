class Task {
	/**
	 * Creates a new task
	 * @param {string} target Where to run the task (master/worker/all)
	 */
	constructor(target) {
		this.runOnMaster = ['master', 'all'].includes((target));
		this.runOnWorker = ['worker', 'all'].includes((target));
	}

	run() {
		throw new Error('non-overridden task runner');
	}

	get nextRun() {
		return Infinity;
	}
}

module.exports = Task;
