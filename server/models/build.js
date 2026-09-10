import {spawn} from 'node:child_process';
import {mkdir, readdir, rm, symlink, unlink, lstat, readlink, rename} from 'node:fs/promises';
import {resolve, basename} from 'node:path';
import {BUILDS_DIR, DIST_LINK, BUILDS_KEEP, ROOT_DIR, IS_DEV} from '../config/index.js';

const ASTRO_BIN = resolve(ROOT_DIR, 'node_modules', 'astro', 'bin', 'astro.mjs');

/**
 * Назва збірки: літери, цифри і дефіси. Ні точок, ні слешів — тому назва
 * ніколи не перетворюється на шлях. Назва ще й мусить бути в списку збірок.
 */
const BUILD_NAME_RE = /^[0-9A-Za-z-]+$/;

/** @type {Map<string, Job>} */
const jobs = new Map();

/** одна публікація за раз: два паралельних білди писали б в одну теку */
let running = null;

/**
 * @typedef {{
 *   id: string,
 *   status: 'running'|'done'|'failed',
 *   log: string[],
 *   build: string|null,
 *   error: string|null,
 * }} Job
 */

/**
 * @returns {string}
 */
function createBuildName() {
	return (
		new Date()
		.toISOString()
		.replace(/[:.]/g, '-')
		.replace(/z$/i, '')
	);
}

/**
 * Запускає збірку. Повертає id задачі — статус читається окремим запитом, бо
 * синхронна відповідь впиралася б у таймаути проксі і не давала б лога.
 *
 * @returns {Job}
 */
export function startBuild() {
	if (running) {
		throw {type: 'build_in_progress', job_id: running};
	}

	const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);

	/** @type {Job} */
	const job = {
		id,
		status: 'running',
		log: [],
		build: null,
		error: null,
	};

	jobs.set(id, job);
	pruneJobs();

	running = id;

	if (IS_DEV) {
		// в dev збірки немає: astro dev підхоплює .md через HMR
		job.log.push('dev-режим: збірка не потрібна, astro dev підхопить зміни сам');
		job.status = 'done';
		running = null;

		return job;
	}

	runBuild(job)
	.catch(function (err) {
		job.status = 'failed';
		job.error = err?.message || err?.type || String(err);
	})
	.finally(function () {
		running = null;
	});

	return job;
}

/**
 * @param {Job} job
 * @returns {Promise<void>}
 */
async function runBuild(job) {
	await mkdir(BUILDS_DIR, {recursive: true});

	const name = createBuildName();
	const target = resolve(BUILDS_DIR, name);

	job.build = name;
	job.log.push('збірка в ' + target);

	const code = await spawnBuild(target, line => job.log.push(line));

	if (code !== 0) {
		job.status = 'failed';
		job.error = 'astro build завершився з кодом ' + code;

		// невдала збірка не лишається на диску і симлінк не переставляється
		await rm(target, {recursive: true, force: true});

		return;
	}

	await swapLink(target, line => job.log.push(line));
	await pruneBuilds(line => job.log.push(line));

	job.status = 'done';
	job.log.push('готово');
}

/**
 * Команда фіксована: жоден її елемент не приходить із запиту.
 *
 * @param {string} outDir
 * @param {(line: string) => void} onLine
 * @returns {Promise<number>}
 */
function spawnBuild(outDir, onLine) {
	return new Promise(function (done, fail) {
		const proc = spawn(process.execPath, [ASTRO_BIN, 'build'], {
			cwd: ROOT_DIR,
			env: {
				...process.env,
				ASTRO_OUT_DIR: outDir,
			},
		});

		const collect = (chunk) => {
			for (const line of String(chunk).split(/\r?\n/)) {
				if (line.trim()) onLine(line);
			}
		};

		proc.stdout.on('data', collect);
		proc.stderr.on('data', collect);

		proc.on('error', fail);
		proc.on('close', done);
	});
}

/**
 * @param {string} target
 * @param {(line: string) => void} onLine
 * @returns {Promise<void>}
 */
async function swapLink(target, onLine) {
	const stat = await lstat(DIST_LINK).catch(() => null);

	if (stat?.isSymbolicLink()) {
		await unlink(DIST_LINK);
	}
	else if (stat?.isDirectory()) {
		// перший запуск: dist ще звичайна тека. Не видаляємо, а переносимо в
		// збірки — так вона доступна для відкату і піде під prune своєю чергою
		const legacy = resolve(BUILDS_DIR, 'legacy-' + createBuildName());

		await rename(DIST_LINK, legacy);

		onLine('стару теку dist перенесено в ' + legacy);
	}

	await symlink(target, DIST_LINK, 'dir').catch(function (err) {
		// на Windows симлінк потребує прав; у prod (linux + nginx) це не виникає
		throw {type: 'symlink_failed', reason: err?.code || err?.message};
	});

	onLine('dist -> ' + target);
}

/**
 * @returns {Promise<string|null>} назва активної збірки
 */
export async function getActiveBuild() {
	const stat = await lstat(DIST_LINK).catch(() => null);

	if (!stat?.isSymbolicLink()) return null;

	return basename(await readlink(DIST_LINK));
}

/**
 * @returns {Promise<Array<{name: string, active: boolean}>>}
 */
export async function listBuilds() {
	const active = await getActiveBuild();
	const items = await readdir(BUILDS_DIR, {withFileTypes: true}).catch(() => []);

	return (
		items
		.filter(item => item.isDirectory())
		.map(item => item.name)
		.sort()
		.reverse()
		.map(name => ({name, active: name === active}))
	);
}

/**
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function rollbackTo(name) {
	if (typeof name !== 'string' || !BUILD_NAME_RE.test(name)) {
		throw {type: 'invalid_build', name};
	}

	const builds = await listBuilds();

	if (!builds.some(build => build.name === name)) {
		throw {type: 'unknown_build', name};
	}

	await swapLink(resolve(BUILDS_DIR, name), () => {});
}

/**
 * @param {(line: string) => void} onLine
 * @returns {Promise<void>}
 */
async function pruneBuilds(onLine) {
	const builds = await listBuilds();
	const extra = builds.slice(BUILDS_KEEP);

	for (const build of extra) {
		if (build.active) continue; // активну не видаляємо ні за яких умов

		await rm(resolve(BUILDS_DIR, build.name), {recursive: true, force: true});

		onLine('видалено стару збірку ' + build.name);
	}
}

/**
 * @param {string} id
 * @returns {Job|null}
 */
export function getJob(id) {
	return jobs.get(id) || null;
}

function pruneJobs() {
	const ids = Array.from(jobs.keys());

	while (ids.length > 20) {
		jobs.delete(ids.shift());
	}
}
