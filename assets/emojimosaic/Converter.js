const fs = require('fs/promises');
const {Image} = require('imagescript');

const emojiSize = 24;
const logString = '\rCalculating emoji {n}/{t}: {p}% done';
const outputFile = 'meta.json';

/**
 * Calculates average color data for all Emojis in the given Emoji sprite
 */
class EmojiSpriteConverter {
	constructor() {
		// noinspection JSIgnoredPromiseFromCall
		this.convert();
	}

	static updateProgress(index, count) {
		process.stdout.write(logString.replace('{n}', index).replace('{t}', count).replace('{p}', (index / count * 100).toFixed(2)));
	}

	static async save(data) {
		await fs.writeFile(outputFile, JSON.stringify({emojiSize: emojiSize, averages: data}));
		console.log(`\nDone! Wrote output to ${outputFile}`); // eslint-disable-line no-console
	}

	async convert() {
		const spriteBinary = await fs.readFile('./sprite.png');
		const sprite = await Image.decode(spriteBinary);
		const spriteSize = sprite.width / emojiSize;
		const data = [];

		for (let spriteIndex = 0; spriteIndex < spriteSize * sprite.height / emojiSize; spriteIndex++) {
			EmojiSpriteConverter.updateProgress(spriteIndex + 1, spriteSize * sprite.height / emojiSize);

			const spriteStartX = (spriteIndex % spriteSize) * emojiSize;
			const spriteStartY = Math.floor(spriteIndex / spriteSize) * emojiSize;

			const averages = [0, 0, 0, 0];

			const cropped = sprite.__crop__(spriteStartX, spriteStartY, emojiSize, emojiSize);

			for (const [, , color] of cropped.iterateWithColors()) {
				if (!(color & 0xff))
					continue;
				const pixelData = Image.colorToRGBA(color);
				for (let i = 0; i < 4; i++)
					averages[i] += pixelData[i];
			}

			for (let i = 0; i < 4; i++)
				averages[i] = Math.round(averages[i] / emojiSize ** 2);

			data[spriteIndex] = averages;
		}

		await EmojiSpriteConverter.save(data);
	}
}

module.exports = new EmojiSpriteConverter();
