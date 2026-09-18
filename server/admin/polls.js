import {Router} from 'express';
import multer from 'multer';
import {basename} from 'node:path';
import {IMAGES_URL} from '../config/index.js';
import db from '../db/index.js';
import Answers from '../models/answers.js';
import Statistic from '../models/statistic.js';
import {reloadPollsData} from '../models/polls.js';
import {
	listPollFiles,
	readPollFile,
	readPollFileByPath,
	writePollFile,
	deletePollFile,
	findSlugConflict,
	validateSlug,
	toStructure,
	fromStructure,
	parsePoll,
	retypeBody,
	slugify,
	imageFilesOf,
	imageNameFromUrl,
	findImageRefs,
	findDefinedIds,
} from '../models/pollFile.js';
import {IMAGE_NAME_RE, newImageName, saveImage, removeImages} from '../models/images.js';
import {IMAGE_ID_RE, mapImageFields} from './imageFields.js';
import {assertValuesPreserved} from './valueGuard.js';

export const router = Router({mergeParams: true});

/** ліміт на вхідний файл; після обробки картинка все одно стане меншою */
const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

/** скільки нових картинок можна привезти одним збереженням */
const MAX_IMAGES = 10;

/** ліміт на поле data; це текст опитування, картинки сюди не входять */
const MAX_BODY = 2 * 1024 * 1024;

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {fileSize: MAX_IMAGE_SIZE, files: MAX_IMAGES, fieldSize: MAX_BODY},
});

/** ліміти multer у типи помилок адмінки */
const UPLOAD_ERRORS = new Map([
	['LIMIT_FILE_SIZE', 'image_too_large'],
	['LIMIT_FILE_COUNT', 'too_many_images'],
	['LIMIT_FIELD_VALUE', 'poll_too_large'],
]);

router.post('/list', async function (req, res) {
	const files = await listPollFiles();

	// підтеки в адмінці не показуються, але в перевірці колізій враховуються
	const roots = files.filter(file => !/[\\/]/.test(file));

	const items = [];

	for (const file of roots) {
		const slug = basename(file, '.md');
		const md = await readPollFileByPath(file);

		try {
			const struct = toStructure(md, file);

			items.push({
				slug,
				title: struct.title || slug,
				expire: struct.expire,
				public: struct.public,
				draft: struct.draft,
				groups: struct.groups.length,
				error: null,
			});
		}
		catch (err) {
			// файл із помилкою синтаксису мусить бути видимим, а не зникати зі списку
			items.push({
				slug,
				title: slug,
				expire: null,
				public: false,
				draft: false,
				groups: 0,
				error: err?.type || String(err?.message || err),
			});
		}
	}

	const votes = await Answers.countVoters(items.map(item => item.slug));

	res.json({
		polls: items.map(item => ({...item, votes: votes[item.slug] || 0})),
	});
});

router.post('/get', async function (req, res) {
	const {slug} = req.body;

	validateSlug(slug);

	const md = await readPollFile(slug).catch(function (err) {
		if (err?.code === 'ENOENT') throw {type: 'not_found', slug};

		throw err;
	});

	const struct = toStructure(md, slug + '.md');
	const valueCounts = await Answers.countValues(slug);
	const votes = (await Answers.countVoters([slug]))[slug] || 0;

	res.json({
		slug,
		...struct,
		votes,
		valueCounts,
		// після першого голосу id вже не перепривʼязати: statistic.user_id це
		// хеш, що включає id опитування
		slugLocked: votes > 0,
	});
});

router.post('/slug', async function (req, res) {
	res.json({slug: slugify(req.body.title)});
});

router.post('/retype', async function (req, res) {
	const type = req.body.type === 'radio' ? 'radio' : 'checkbox';

	res.json({body: retypeBody(req.body.body, type)});
});

/**
 * Опитування приходить multipart: поле `data` з JSON і картинки, у яких
 * назва поля — id картинки в тексті. Тіла на момент адмінської перевірки ще
 * немає, тому jwt для цього маршруту іде в заголовку Authorization.
 */
router.post('/save', function (req, res, next) {
	upload.any()(req, res, function (err) {
		const type = UPLOAD_ERRORS.get(err?.code);

		next(type ? {type} : err);
	});
}, async function (req, res) {
	const body = parseBody(req.body?.data);

	const {slug, prev_slug, title, intro, groups, outro, hideQuestions, expire, draft} = body;
	const pub = body.public;

	validateSlug(slug);

	if (prev_slug) {
		validateSlug(prev_slug);
	}

	if (!title || !String(title).trim()) {
		throw {type: 'empty_title'};
	}

	if (!Array.isArray(groups) || groups.length === 0) {
		throw {type: 'no_groups'};
	}

	const target = prev_slug || slug;
	const isRename = !!prev_slug && prev_slug !== slug;
	const votes = (await Answers.countVoters([target]))[target] || 0;

	if (isRename && votes > 0) {
		throw {type: 'slug_locked', slug: prev_slug, votes};
	}

	const conflict = await findSlugConflict(slug);

	if (conflict && !(prev_slug === slug)) {
		throw {type: 'slug_conflict', slug, file: conflict};
	}

	const images = normalizeImages(body.images);

	// нові картинки отримують імена до обробки: адреса має пройти ті самі
	// перевірки, що й у вже збережених, ще до того, як щось ляже на диск
	const uploads = mapImageFields(req.files, new Set(Object.keys(images)), newImageName);

	for (const [id, item] of uploads) {
		images[id] = IMAGES_URL + item.name;
	}

	assertImagesDefined({intro, groups, outro}, images);

	const md = fromStructure({title, intro, groups, outro, hideQuestions, images, expire, public: pub, draft});

	// розбір щойно згенерованого файлу — це і є валідація DSL
	const parsed = parsePoll(md, slug + '.md');

	if (parsed.values.length === 0) {
		throw {type: 'no_groups'};
	}

	const prevMd = await readPollFile(target).catch(() => null);

	if (votes > 0 && prevMd !== null) {
		assertValuesPreserved(prevMd, parsed, await Answers.countValues(target), target + '.md');
	}

	const nextImages = new Set(imageFilesOf(md));
	const prevImages = prevMd === null ? [] : imageFilesOf(prevMd);

	// імена вже записаних картинок, щоб прибрати їх, якщо збереження впаде
	const written = [];

	let saved = false;

	try {
		// картинки лягають на диск після всіх перевірок, щоб відхилене
		// збереження не лишало файлів
		for (const {name, buffer} of uploads.values()) {
			// картинки, чий токен зник з тексту, поки летів запит: визначення в
			// .md для них немає, тож файл став би сиротою одразу після запису
			if (!nextImages.has(name)) continue;

			await saveImage(buffer, name);

			written.push(name);
		}

		await writePollFile(slug, md);

		saved = true;

		if (isRename) {
			await deletePollFile(prev_slug);
		}

		await reloadPollsData();
	}
	catch (err) {
		// картинка без файлу, який на неї посилається, вже нічия: імена
		// унікальні на кожне завантаження, тому інше опитування їх не втратить
		await removeImages(written);

		// відновлювати нема чого, якщо запис самого файлу і не відбувся
		if (saved) {
			// сервер не має лишитись із непрацездатним кешем опитувань
			await restore({slug, prev_slug: isRename ? prev_slug : null, prevMd});
		}

		throw err;
	}

	// картинки, які були у файлі, а тепер ні. Імена унікальні на кожне
	// завантаження, тому інше опитування на них посилатись не може
	await removeImages(prevImages.filter(name => !nextImages.has(name)));

	// клієнт заміщає цим свою мапу, тому в ній лише ті картинки, що справді
	// потрапили у файл: адреса на незаписану картинку лишила б порожню мініатюру
	const savedImages = {};

	for (const [id, url] of Object.entries(images)) {
		if (nextImages.has(imageNameFromUrl(url))) {
			savedImages[id] = url;
		}
	}

	res.json({slug, images: savedImages});
});

router.post('/delete', async function (req, res) {
	const {slug, confirm} = req.body;

	validateSlug(slug);

	if (confirm !== slug) {
		throw {type: 'confirm_mismatch'};
	}

	// читаємо до видалення: після нього вже не дізнатись, які картинки були
	const md = await readPollFile(slug).catch(() => null);

	await db.trx([
		Answers.removeByPoll(slug),
		Statistic.removeByPoll(slug),
		Statistic.removeArchiveByPoll(slug),
	]);

	await deletePollFile(slug).catch(function (err) {
		if (err?.code === 'ENOENT') return;

		throw err;
	});

	await reloadPollsData();

	if (md !== null) {
		await removeImages(imageFilesOf(md));
	}

	res.json(true);
});

/**
 * Структура опитування приїздить полем multipart, тому JSON розбирається
 * тут, а не express.json.
 *
 * @param {*} data
 * @returns {Object}
 */
function parseBody(data) {
	if (typeof data !== 'string') throw {type: 'invalid_body'};

	let parsed;

	try {
		parsed = JSON.parse(data);
	}
	catch {
		throw {type: 'invalid_body'};
	}

	if (!parsed || typeof parsed !== 'object') throw {type: 'invalid_body'};

	return parsed;
}

/**
 * Мапа id → адреса від клієнта. Приймаються лише адреси з IMAGES_URL з іменем
 * файлу правильної форми: усе інше — невідома картинка, а не шлях на диску.
 *
 * @param {*} value
 * @returns {Object<string, string>}
 */
function normalizeImages(value) {
	const images = {};

	if (!value || typeof value !== 'object') return images;

	const unknown = [];

	for (const [id, url] of Object.entries(value)) {
		if (!IMAGE_ID_RE.test(id)) throw {type: 'invalid_body'};

		const name = imageNameFromUrl(url);

		if (!name || !IMAGE_NAME_RE.test(name)) {
			unknown.push(String(url));
			continue;
		}

		images[id] = IMAGES_URL + name;
	}

	if (unknown.length > 0) {
		throw {type: 'image_unknown', names: unknown};
	}

	return images;
}

/**
 * Кожна посилальна картинка в тексті мусить мати або картинку від адмінки, або
 * власне визначення, написане руками. Інакше у файл потрапило б посилання, що
 * рендериться як текст.
 *
 * @param {{intro?: string, groups?: Array<{body?: string}>, outro?: string}} struct
 * @param {Object<string, string>} images
 */
function assertImagesDefined(struct, images) {
	const text = [
		struct.intro || '',
		...(Array.isArray(struct.groups) ? struct.groups : []).map(group => group?.body || ''),
		struct.outro || '',
	].join('\n');

	const defined = findDefinedIds(text);
	const missing = findImageRefs(text).filter(id => !images[id] && !defined.includes(id));

	if (missing.length > 0) {
		throw {type: 'image_unknown', ids: missing};
	}
}

/**
 * @param {{slug: string, prev_slug: string|null, prevMd: string|null}} state
 */
async function restore({slug, prev_slug, prevMd}) {
	if (prev_slug) {
		await deletePollFile(slug).catch(() => {});

		if (prevMd !== null) {
			await writePollFile(prev_slug, prevMd).catch(() => {});
		}
	}
	else if (prevMd !== null) {
		await writePollFile(slug, prevMd).catch(() => {});
	}
	else {
		await deletePollFile(slug).catch(() => {});
	}

	await reloadPollsData().catch(() => {});
}
