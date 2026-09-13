import {Router} from 'express';
import {basename} from 'node:path';
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
} from '../models/pollFile.js';
import {handler} from './errors.js';
import {assertValuesPreserved} from './valueGuard.js';

export const router = Router({mergeParams: true});

router.post('/list', handler(async function (req, res) {
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
}));

router.post('/get', handler(async function (req, res) {
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
}));

router.post('/slug', handler(async function (req, res) {
	res.json({slug: slugify(req.body.title)});
}));

router.post('/retype', handler(async function (req, res) {
	const type = req.body.type === 'radio' ? 'radio' : 'checkbox';

	res.json({body: retypeBody(req.body.body, type)});
}));

router.post('/save', handler(async function (req, res) {
	const {slug, prev_slug, title, intro, groups, outro, hideQuestions, expire, draft} = req.body;
	const pub = req.body.public;

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

	const md = fromStructure({title, intro, groups, outro, hideQuestions, expire, public: pub, draft});

	// розбір щойно згенерованого файлу — це і є валідація DSL
	const parsed = parsePoll(md, slug + '.md');

	if (parsed.values.length === 0) {
		throw {type: 'no_groups'};
	}

	const prevMd = await readPollFile(target).catch(() => null);

	if (votes > 0 && prevMd !== null) {
		assertValuesPreserved(prevMd, parsed, await Answers.countValues(target), target + '.md');
	}

	await writePollFile(slug, md);

	if (isRename) {
		await deletePollFile(prev_slug);
	}

	try {
		await reloadPollsData();
	}
	catch (err) {
		// сервер не має лишитись із непрацездатним кешем опитувань
		await restore({slug, prev_slug: isRename ? prev_slug : null, prevMd});

		throw err;
	}

	res.json({slug});
}));

router.post('/delete', handler(async function (req, res) {
	const {slug, confirm} = req.body;

	validateSlug(slug);

	if (confirm !== slug) {
		throw {type: 'confirm_mismatch'};
	}

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

	res.json(true);
}));

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
