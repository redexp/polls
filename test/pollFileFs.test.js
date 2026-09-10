import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, basename} from 'node:path';

const dir = mkdtempSync(resolve(tmpdir(), 'polls-test-'));

// POLLS_DIR читається при завантаженні конфігу, тому імпорт — динамічний
process.env.POLLS_DIR = dir;

/** @type {typeof import('../server/models/pollFile.js')} */
let PollFile;
/** @type {typeof import('../server/models/polls.js')} */
let Polls;

before(async function () {
	PollFile = await import('../server/models/pollFile.js');
	Polls = await import('../server/models/polls.js');
});

after(function () {
	rmSync(dir, {recursive: true, force: true});
});

function write(relative, md) {
	const path = resolve(dir, relative);

	mkdirSync(resolve(path, '..'), {recursive: true});
	writeFileSync(path, md, 'utf8');
}

test('slug приймає лише малі латинські літери, цифри і дефіс', function () {
	assert.doesNotThrow(() => PollFile.validateSlug('poll-2027'));

	for (const slug of ['Poll', 'опитування', 'poll_2027', 'poll 2027', '', 'poll.md']) {
		assert.throws(() => PollFile.validateSlug(slug), err => err.type === 'invalid_slug', slug);
	}
});

test('шлях до файлу не виводиться за межі теки опитувань', function () {
	// єдиний бар'єр між клієнтським рядком і довільним записом на диск
	for (const slug of ['../evil', '..\\evil', '/etc/passwd', 'sub/evil', 'a/../../b']) {
		assert.throws(() => PollFile.pollPath(slug), err => err.type === 'invalid_slug', slug);
	}

	assert.equal(basename(PollFile.pollPath('ok')), 'ok.md');
});

test('читання за шляхом не виходить за межі теки', async function () {
	await assert.rejects(
		() => PollFile.readPollFileByPath('../../package.json'),
		err => err.type === 'invalid_path'
	);
});

test('колізія id шукається рекурсивно, включно з підтеками', async function () {
	write('past/old.md', '## Old\n\n[a] A\n');

	// id опитування — це лише basename, тому підтека не робить його унікальним
	assert.equal(await PollFile.findSlugConflict('old'), 'past/old.md');
	assert.equal(await PollFile.findSlugConflict('brand-new'), null);
});

test('файл сам собі не колізія', async function () {
	write('solo.md', '## Solo\n\n[a] A\n');

	assert.equal(await PollFile.findSlugConflict('solo'), null);
});

test('однаковий id у корені й підтеці ламає завантаження', async function () {
	write('old.md', '## Old root\n\n[b] B\n');

	await assert.rejects(() => Polls.reloadPollsData(), err => err.type === 'poll_duplicate');

	rmSync(resolve(dir, 'old.md'));
	rmSync(resolve(dir, 'past'), {recursive: true, force: true});
});

test('чернетка не потрапляє в дані сервера', async function () {
	write('live.md', '---\npublic: true\ndraft: false\n---\n\n## Live\n\n[a] A\n');
	write('hidden.md', '---\npublic: true\ndraft: true\n---\n\n## Hidden\n\n[b] B\n');

	const polls = await Polls.reloadPollsData();

	assert.ok(polls.has('live'));
	assert.ok(!polls.has('hidden'), 'чернетка мусить відхилятись як invalid_poll_id');

	assert.equal(Polls.isValidPollValues('hidden', ['b']), 'invalid_poll_id');
	assert.equal(Polls.isValidPollValues('live', ['a']), true);
});

test('запис і видалення файлу опитування', async function () {
	const md = PollFile.fromStructure({
		title: 'Новий',
		groups: [{body: '[a] A\n[b] B'}],
		public: true,
	});

	await PollFile.writePollFile('fresh', md);

	assert.equal(await PollFile.pollFileExists('fresh'), true);
	assert.equal(await PollFile.readPollFile('fresh'), md);

	await PollFile.deletePollFile('fresh');

	assert.equal(await PollFile.pollFileExists('fresh'), false);
});
