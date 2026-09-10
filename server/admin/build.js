import {Router} from 'express';
import {reloadPollsData} from '../models/polls.js';
import {startBuild, getJob, listBuilds, rollbackTo} from '../models/build.js';
import {
	readPollFile,
	writePollFile,
	toStructure,
	fromStructure,
	validateSlug,
} from '../models/pollFile.js';
import {handler} from './errors.js';

export const router = Router({mergeParams: true});

router.post('/publish', handler(async function (req, res) {
	const {slug} = req.body;

	if (slug) {
		validateSlug(slug);

		await undraft(slug);
		await reloadPollsData();
	}

	const job = startBuild();

	res.json(toJson(job));
}));

router.post('/publish/status', handler(async function (req, res) {
	const job = getJob(req.body.job_id);

	if (!job) {
		throw {type: 'job_not_found', job_id: req.body.job_id};
	}

	res.json(toJson(job));
}));

router.post('/builds', handler(async function (req, res) {
	res.json({builds: await listBuilds()});
}));

router.post('/rollback', handler(async function (req, res) {
	await rollbackTo(req.body.name);

	res.json({builds: await listBuilds()});
}));

/**
 * Знімає чернетку. Проходить через генератор, а не через regex по frontmatter,
 * щоб файл лишався тим, що вміє прочитати конструктор.
 *
 * @param {string} slug
 * @returns {Promise<void>}
 */
async function undraft(slug) {
	const md = await readPollFile(slug).catch(function (err) {
		if (err?.code === 'ENOENT') throw {type: 'not_found', slug};

		throw err;
	});

	const struct = toStructure(md, slug + '.md');

	if (!struct.draft) return;

	struct.draft = false;

	await writePollFile(slug, fromStructure(struct));
}

/**
 * @param {import('../models/build.js').Job} job
 */
function toJson(job) {
	return {
		job_id: job.id,
		status: job.status,
		log: job.log,
		build: job.build,
		error: job.error,
	};
}
