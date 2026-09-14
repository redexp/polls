import {Router} from 'express';
import {processor} from '../../src/lib/processor.js';
import {fromStructure, stripFrontmatter, parsePoll, parseSegment} from '../models/pollFile.js';
import {handler} from './errors.js';

export const router = Router({mergeParams: true});

let renderer = null;

/**
 * Той самий процесор, що й у збірці — інакше прев'ю показувало б не те, що
 * потім опублікується.
 */
async function getRenderer() {
	if (!renderer) {
		renderer = await processor.createRenderer({});
	}

	return renderer;
}

router.post('/preview', handler(async function (req, res) {
	const {title, intro, groups, outro, hideQuestions, expire, draft} = req.body;
	const pub = req.body.public;

	// адреси картинок тут не перевіряються: для ще не збережених клієнт шле
	// blob:-адреси, які браузер показує сам. Перевірка — лише при збереженні
	const images = plainStrings(req.body.images);

	const md = fromStructure({title, intro, groups, outro, hideQuestions, images, expire, public: pub, draft});
	const {body} = stripFrontmatter(md);

	// валідація цілого файлу — щоб прев'ю не показувало те, що не збережеться
	parsePoll(md);

	const {code} = await (await getRenderer()).render(body);

	res.json({
		html: code,
		md,
		// розбір кожної групи окремо, рівно в тому ж порядку, що прийшов від
		// конструктора: так індекси збігаються навіть якщо група порожня.
		// Конструктор через це не тримає власної копії знань про синтаксис
		groups: (groups || []).map(function (group) {
			const parsed = parseSegment(String(group?.body || '').split(/\r?\n/));

			if (!parsed) return null;

			return {
				type: parsed.type,
				values: parsed.values,
			};
		}),
	});
}));

/**
 * @param {*} value
 * @returns {Object<string, string>}
 */
function plainStrings(value) {
	const result = {};

	if (!value || typeof value !== 'object') return result;

	for (const [key, item] of Object.entries(value)) {
		if (typeof item === 'string') result[key] = item;
	}

	return result;
}
