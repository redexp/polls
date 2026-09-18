import sharp from 'sharp';
import {randomBytes} from 'node:crypto';
import {mkdir, unlink, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {UPLOADS_DIR} from '../config/index.js';

/**
 * Ім'я файлу: 16 hex і розширення. Випадкове і унікальне на кожне завантаження,
 * без дедуплікації — так видалення за різницею старого і нового опитування
 * безпечне без сканування решти файлів. Ні точок, ні слешів у самому імені,
 * тому ім'я ніколи не перетворюється на шлях.
 */
export const IMAGE_NAME_RE = /^[0-9a-f]{16}\.webp$/;

/** формати, які приймаємо; перевіряються за вмістом, а не за розширенням */
const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp']);

/** картка опитування вужча за 800px, 1600 — запас під retina */
const MAX_WIDTH = 1600;

/**
 * Ім'я для нової картинки. Видається до обробки файлу: адреса потрапляє в
 * структуру опитування і проходить усі перевірки ще до того, як щось лягло на
 * диск. Так можна, бо ім'я не залежить від вмісту.
 *
 * @returns {string}
 */
export function newImageName() {
	return randomBytes(8).toString('hex') + '.webp';
}

/**
 * Приймає завантажений файл: перевіряє формат, ужимає, знімає метадані (разом з
 * GPS з EXIF) і кладе webp під заданим іменем. Викликається лише після всіх
 * перевірок опитування, щоб відхилене збереження не лишало файлів.
 *
 * @param {Buffer} buffer
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function saveImage(buffer, name) {
	const meta = await sharp(buffer).metadata().catch(() => null);

	if (!meta || !ALLOWED_FORMATS.has(meta.format)) {
		throw {type: 'image_type', format: meta?.format || null};
	}

	const out = await (
		sharp(buffer)
		// EXIF-орієнтація застосовується до пікселів, бо самі метадані далі
		// не зберігаються — інакше фото з телефона лягало б боком
		.rotate()
		.resize({width: MAX_WIDTH, withoutEnlargement: true})
		.webp({quality: 82})
		.toBuffer()
	);

	await mkdir(UPLOADS_DIR, {recursive: true});
	await writeFile(resolve(UPLOADS_DIR, name), out);
}

/**
 * Видаляє файли. Відсутній файл — не помилка: його могли прибрати руками, а при
 * відкаті збереження частина імен могла й не дійти до запису.
 *
 * @param {string[]} names
 * @returns {Promise<void>}
 */
export async function removeImages(names) {
	for (const name of names) {
		if (!IMAGE_NAME_RE.test(name)) continue;

		await unlink(resolve(UPLOADS_DIR, name)).catch(() => {});
	}
}
