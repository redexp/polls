import minimist from "minimist";
import {createWriteStream} from 'node:fs';
import {reloadPollsMeta} from '../server/models/polls.js';
import db from '../server/db/index.js';
import ranges from '../server/config/age-groups.js';

const args = minimist(process.argv.slice(2));

const POLL_ID = args['poll'];
const TYPE = args['type'] || 'simple';
const OUTPUT = args['out'] || POLL_ID + '-' + TYPE + '.csv';

const polls = await reloadPollsMeta();

if (!polls.has(POLL_ID)) {
	throw new Error('Invalid --poll');
}

const poll = polls.get(POLL_ID);
const stream = createWriteStream(OUTPUT);

/**
 * @param {Array<string>} cells
 */
const write = (cells) => stream.write(cells.join(',') + '\n');

const close = () => new Promise(done => stream.close(done));

switch (TYPE) {
case "simple":
	await createSimple();
	break;

case "age":
	await createAge();
	break;
case "male":
	await createAge('M');
	break;
case "female":
	await createAge('F');
	break;
}

if (!args['out']) {
	console.log(OUTPUT);
}

process.exit();

function headers(left = 0) {
	const emptyColumns = left > 0 ? new Array(left).fill('') : [];

	write([
		...emptyColumns,
		...(
			poll
			.groups
			.map((g, i) => (
				`Група ${i + 1}` + ','.repeat(g.values.length - 1)
			))
		)
	]);

	write([
		...emptyColumns,
		...poll.values,
	]);
}

async function createSimple() {
	/** @type {import('../server/models/answer').AnswersBuilder} */
	const select = () => db('answers');

	const list = await (
		select()
		.where({
			poll: POLL_ID
		})
	);

	/** @type {Map<string, Set<string>>} */
	const users = new Map();

	for (const {bank_id, value} of list) {
		if (!users.has(bank_id)) {
			users.set(bank_id, new Set());
		}

		users.get(bank_id).add(value);
	}

	headers();

	for (const values of users.values()) {
		write(poll.values.map(v => values.has(v) ? 1 : ''));
	}

	return close();
}

/**
 * @param {'F'|'M'} [sex]
 * @returns {Promise<unknown>}
 */
async function createAge(sex) {
	/** @type {import('../server/models/statistic').StatisticBuilder} */
	const query = () => db('statistic');

	headers(1);

	const counters = [];

	for (let i = 0; i < ranges.length; i++) {
		const [from, to] = ranges[i];

		for (let j = 0; j < poll.values.length; j++) {
			const where = [
				'value = ?',
				'age >= ?',
			];

			const params = [
				poll.values[j],
				from,
			];

			if (to) {
				where.push('age <= ?');
				params.push(to);
			}

			if (sex) {
				where.push('sex = ?');
				params.push(sex);
			}

			counters.push(
				db.raw(`COUNT(CASE WHEN ${where.join(' AND ')} THEN 1 END) as age${i}_${j}`, params)
			);
		}
	}

	const [counts] = await (
		query()
		.select(...counters)
		.where({
			poll: POLL_ID,
		})
	);

	for (let i = 0; i < ranges.length; i++) {
		const range = ranges[i];

		write([
			range.join('-'),
			...poll.values.map((v, j) => counts[`age${i}_${j}`] || ''),
		]);
	}

	return close();
}