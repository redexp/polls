import {readdir, readFile} from "node:fs/promises";
import {resolve, basename} from 'node:path';
import {parse} from 'yaml';
import moment from "moment";
import {POLLS_DIR} from '../config/index.js';

/** @type {Map<string, PollMeta>} */
export const polls = new Map();

/**
 * @returns {Promise<Map<string, PollMeta>>}
 */
export async function reloadPollsData() {
	polls.clear();

	const list = await readdir(POLLS_DIR, {recursive: true});

	for (const filepath of list) {
		if (!filepath.endsWith('.md')) continue;

		const poll = {
			id: basename(filepath, '.md'),
			expire: null,
			public: false,
			values: [],
			groups: [],
		};

		if (polls.has(poll.id)) {
			throw {
				type: 'poll_duplicate',
				file: filepath,
			};
		}

		let group = {
			type: '',
			values: [],
		};

		let md = await readFile(resolve(POLLS_DIR, filepath), 'utf8');

		// yaml
		md = md.replace(/^---+\s*\r?\n(.*?)\r?\n---+\s*\r?\n/s, function (_, yaml) {
			const data = parse(yaml);

			poll.expire = data.expire && moment(data.expire);
			poll.public = !!data.public;

			return '';
		});

		md = md.replace(/^\s*\\\[([^\]]+)\\\]/gm, '[$1]'); // replace \[...\] with [...]

		// find at line start --- or [ or (
		md.replace(/^\s*(---|[\[\(]).*$/gm, function (line, mode) {
			if (mode === '---') {
				if (!group.type) return line;

				poll.groups.push(group);

				group = {
					type: '',
					values: [],
				};

				return line;
			}

			const type = mode === '[' ? 'checkbox' : 'radio';
			const match = line.trim().match(
				type === 'checkbox' ?
					/^\[([^\]]+)\](:?)/ : // match [...], colon `:` et the end means - image ref, then ignore it
					/^\(([^\)]+)\)/       // match (...)
			);
			const value = match && match[1].trim();

			if (!match) {
				throw {
					type: 'invalid_closing_bracket',
					file: filepath,
					line,
				};
			}

			if (type === 'checkbox' && match[2] === ':') return line; // means it's image ref like - [image]: <data....

			if (!value) {
				throw {
					type: 'empty_value',
					file: filepath,
					line,
				};
			}

			if (poll.values.includes(value)) {
				throw {
					type: 'value_duplicate',
					file: filepath,
					line,
				};
			}

			if (group.type && group.type !== type) {
				throw {
					type: 'mix_types',
					file: filepath,
					line,
				};
			}

			group.type = type;
			group.values.push(value);
			poll.values.push(value);
		});

		if (group.type !== '' && !poll.groups.includes(group)) {
			poll.groups.push(group);
		}

		polls.set(poll.id, poll);
	}

	return polls;
}

/**
 * @param {string} poll_id
 * @param {Array<string>} values
 * @returns {boolean|string}
 */
export function isValidPollValues(poll_id, values) {
	if (
		!poll_id ||
		!Array.isArray(values) ||
		values.length === 0
	) {
		return "empty_values";
	}

	const poll = polls.get(poll_id);

	if (!poll) return "invalid_poll_id";

	if (poll.expire && poll.expire > moment()) return "expired";

	if (!includesAll(poll.values, values)) return "invalid_values";

	for (const group of poll.groups) {
		if (group.type !== 'radio') continue;

		if (!includesOnlyOne(group.values, values)) return "many_radio_values";
	}

	return true;
}

export function isPublicPoll(poll_id) {
	const poll = polls.get(poll_id);

	return !!poll?.public;
}

/**
 * @param {Array<string>} values
 * @param {Array<string>} list
 * @returns {boolean}
 */
function includesAll(values, list) {
	for (const v of list) {
		if (!values.includes(v)) return false;
	}

	return true;
}

/**
 * @param {Array<string>} values
 * @param {Array<string>} list
 * @returns {boolean}
 */
function includesOnlyOne(values, list) {
	let count = 0;

	for (const v of list) {
		if (values.includes(v)) {
			count++;

			if (count > 1) {
				return false;
			}
		}
	}

	return true;
}