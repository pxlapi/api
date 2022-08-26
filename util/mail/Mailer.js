const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');
const Logger = require('../log/Logger');

class Mailer {
	/**
	 * @param {object} config The configuration to use
	 * @param {object} config.options The options to pass to nodemailer
	 * @param {object} config.defaults The defaults to use
	 */
	constructor({options, defaults}) {
		/** @type {Mail} */
		this.transporter = nodemailer.createTransport(options, defaults);
	}

	static exists(path) {
		return fs.access(path).then(() => true).catch(() => false);
	}

	/**
	 * @param {string} to Email address to send the email to
	 * @param {string} templateName The email's template name
	 * @param {Object<string, string>} [replacements] The replacement values for the email template
	 */
	async sendMail(to, templateName, replacements) {
		const parts = templateName.split('/');

		const templateLocation = path.resolve('templates', 'email', 'template.html');
		const htmlContentLocation = path.resolve('templates', 'email', ...parts, `${parts[parts.length - 1]}.html`);
		const textContentLocation = path.resolve('templates', 'email', ...parts, `${parts[parts.length - 1]}.txt`);
		const subjectLocation = path.resolve('templates', 'email', ...parts, `subject.txt`);
		const footerLocation = path.resolve('templates', 'email', ...parts, 'footer.html');

		if (!await Mailer.exists(htmlContentLocation))
			throw new Error(`Template ${templateName} does not exist`);
		if (!await Mailer.exists(subjectLocation))
			throw new Error(`Template ${templateName} has no subject!`);

		const subject = Mailer.replaceVariables(
			(await fs.readFile(subjectLocation).then(r => r.toString().trim())),
			replacements,
			false
		);

		let footer;
		if (await Mailer.exists(footerLocation))
			footer = `${await fs.readFile(footerLocation)}<br>`;

		const htmlContent = `${await fs.readFile(htmlContentLocation)}<br><br>`;

		let textContent;
		if (await Mailer.exists(textContentLocation))
			textContent = (await fs.readFile(textContentLocation)).toString();
		else Logger.warn(`No text content for email template ${templateName}`);

		let htmlTemplate = (await fs.readFile(templateLocation)).toString();
		htmlTemplate = htmlTemplate.replace('{{content}}', htmlContent);

		htmlTemplate = htmlTemplate.replace('{{footer}}', footer ?? '');
		htmlTemplate = Mailer.replaceVariables(htmlTemplate, replacements);

		if (textContent)
			textContent = Mailer.replaceVariables(textContent, replacements, false);

		return this.transporter.sendMail({
			to,
			subject,
			html: htmlTemplate,
			text: textContent
		});
	}

	static replaceVariables(content, replacements, sanitize = true) {
		return content
			.replace(/{{([^}]+)}}/g, (match, key) => sanitize ? Mailer.sanitizeReplacement(replacements[key] ?? match) : replacements[key] ?? match);
	}

	static sanitizeReplacement(value) {
		if (typeof value !== 'string')
			value = String(value);

		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/{/g, '&#123;')
			.replace(/}/g, '&#125;')
			.replace(/\n/g, ' ');
	}

}

module.exports = Mailer;
