import {Router} from 'express';
import {processor} from '../../src/lib/processor.js';
import {fromStructure, stripFrontmatter, hasProseRange, parsePoll} from '../models/pollFile.js';
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
	const {title, intro, groups, expire, draft} = req.body;
	const pub = req.body.public;

	const md = fromStructure({title, intro, groups, expire, public: pub, draft});
	const {body} = stripFrontmatter(md);
	const parsed = parsePoll(md);

	const {code} = await (await getRenderer()).render(body);

	res.json({
		html: code,
		md,
		// типи груп повертає сервер, щоб конструктор не тримав власної копії
		// знань про синтаксис
		groups: parsed.groups.map(group => ({
			type: group.type,
			count: group.values.length,
			min: group.min,
			max: group.max,
		})),
		// парсинг прози скасований, тому такий текст більше нічого не робить
		proseRange: hasProseRange(body),
	});
}));
