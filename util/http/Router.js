const fs = require('fs');
const path = require('path');

class Router {
	constructor(controllerPath) {
		/**
		 * @type {{controller: Controller, path: string}[]}
		 */
		this.routes = [];
		this.index(controllerPath);
	}

	index(directory) {
		const entries = fs.readdirSync(directory);
		for (const entry of entries) {
			const resolvedPath = path.resolve(directory, entry);
			if (fs.lstatSync(resolvedPath).isDirectory())
				this.index(resolvedPath);
			else {
				const controllerClass = require(resolvedPath);
				new controllerClass(this);
			}
		}
	}

	/**
	 * @param {string} pathname
	 */
	find(pathname) {
		if (pathname[pathname.length - 1] === '/')
			pathname = pathname.substring(0, pathname.length - 1);

		const splitIncoming = pathname.split('/');
		for (const route of this.routes) {
			const split = route.path.split('/');
			if (splitIncoming.length < split.length - 1)
				continue;

			/** @type {Map<string, string>} */
			const pathArgs = new Map();

			let match = false;
			for (let i = 0; i < split.length; i++) {
				const splitPart = split[i];
				const splitPartIncoming = splitIncoming[i];
				if (splitPart[0] === '{' && splitPart[splitPart.length - 1] === '}') {
					if (splitPartIncoming)
						pathArgs.set(splitPart.substring(1, splitPart.length - 1), splitPartIncoming);
				} else if (splitPart !== splitPartIncoming) {
					match = false;
					break;
				}

				if (i === splitIncoming.length - 1)
					match = true;
			}

			if (!match)
				continue;

			/**
			 * @property {{controller: Controller, path: string}} route
			 * @property {Map} pathArgs
			 */
			return {
				route,
				pathArgs
			};
		}
	}

	/**
	 * @param {Controller} controller
	 * @param {string[]} paths
	 */
	route(controller, paths) {
		if (this.routes.some(route => route.controller.constructor.name === controller.constructor.name))
			throw new Error(`Controller with name ${controller.constructor.name} already exists!`);

		for (let path of paths) {
			if (path[0] !== '/')
				path = `/${path}`;
			if (path[path.length - 1] === '/')
				path = path.substring(0, path.length - 1);

			this.routes.push({
				controller,
				path
			});
		}
	}
}

module.exports = Router;
