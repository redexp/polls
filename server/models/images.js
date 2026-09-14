import sharp from 'sharp';
import {randomBytes} from 'node:crypto';
import {mkdir, readdir, stat, rename, unlink, writeFile, access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {UPLOADS_DIR, UPLOADS_TMP_DIR} from '../config/index.js';

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

/** скільки живе файл у тимчасовій теці, якщо опитування так і не зберегли */
const TMP_TTL = 60 * 60 * 1000;

/**
 * Приймає завантажений файл: перевіряє формат, ужимає, знімає метадані (разом з
 * GPS з EXIF) і кладе webp у тимчасову теку. Файл стає постійним лише разом
 * зі збереженням опитування — див. commitImages.
 *
 * @param {Buffer} buffer
 * @returns {Promise<string>} ім'я файлу
 */
export async function storeUpload(buffer) {
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

	const name = randomBytes(8).toString('hex') + '.webp';

	await mkdir(UPLOADS_TMP_DIR, {recursive: true});
	await writeFile(resolve(UPLOADS_TMP_DIR, name), out);

	await pruneTmp();

	return name;
}

/**
 * Прибирає з тимчасової теки все, що старше за TMP_TTL: картинки з опитувань,
 * які так і не зберегли. Викликається при кожному завантаженні.
 *
 * @param {number} [now]
 * @returns {Promise<string[]>} видалені імена
 */
export async function pruneTmp(now = Date.now()) {
	const names = await readdir(UPLOADS_TMP_DIR).catch(() => []);
	const removed = [];

	for (const name of names) {
		const path = resolve(UPLOADS_TMP_DIR, name);
		const info = await stat(path).catch(() => null);

		if (!info?.isFile()) continue;

		if (now - info.mtimeMs < TMP_TTL) continue;

		await unlink(path).catch(() => {});

		removed.push(name);
	}

	return removed;
}

/**
 * Робить файли постійними: переносить із тимчасової теки. Ті, що вже постійні,
 * лишаються як є. Спершу перевіряються всі імена, і лише потім щось рухається —
 * інакше помилка на третьому файлі лишила б перші два сиротами в постійній теці.
 *
 * @param {string[]} names
 * @returns {Promise<void>}
 */
export async function commitImages(names) {
	const pending = [];
	const unknown = [];

	for (const name of names) {
		if (!IMAGE_NAME_RE.test(name)) {
			unknown.push(name);
			continue;
		}

		if (await exists(resolve(UPLOADS_DIR, name))) continue;

		if (await exists(resolve(UPLOADS_TMP_DIR, name))) {
			pending.push(name);
			continue;
		}

		unknown.push(name);
	}

	if (unknown.length > 0) {
		throw {type: 'image_unknown', names: unknown};
	}

	if (pending.length === 0) return;

	await mkdir(UPLOADS_DIR, {recursive: true});

	for (const name of pending) {
		await rename(resolve(UPLOADS_TMP_DIR, name), resolve(UPLOADS_DIR, name));
	}
}

/**
 * Видаляє постійні файли. Відсутній файл — не помилка: його могли прибрати
 * руками.
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

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
function exists(path) {
	return access(path).then(() => true, () => false);
}
