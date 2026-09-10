import {basename} from 'node:path';
import moment from 'moment';
import {listPollFiles, readPollFileByPath, parsePoll} from './pollFile.js';

/** @type {Map<string, PollMeta>} */
export const polls = new Map();

/**
 * @returns {Promise<Map<string, PollMeta>>}
 */
export async function reloadPollsData() {
	const list = await listPollFiles();
	const next = new Map();

	for (const filepath of list) {
		const id = basename(filepath, '.md');

		if (next.has(id)) {
			throw {
				type: 'poll_duplicate',
				file: filepath,
			};
		}

		const md = await readPollFileByPath(filepath);
		const data = parsePoll(md, filepath);

		// чернетка не існує для публічної частини: сторінка не рендериться,
		// і відповідь на неї має відхилятись як invalid_poll_id
		if (data.draft) continue;

		next.set(id, {
			id,
			expire: data.expire ? moment.utc(data.expire) : null,
			public: data.public,
			values: data.values,
			groups: data.groups,
		});
	}

	polls.clear();

	for (const [id, poll] of next) {
		polls.set(id, poll);
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

	if (poll.expire && poll.expire < moment()) return "expired";

	if (!includesAll(poll.values, values)) return "invalid_values";

	for (const group of poll.groups) {
		if (group.type === 'radio' && !includesOnlyOne(group.values, values)) {
			return "many_radio_values";
		}

		// без цієї перевірки обмеження {min-max} обходиться простим curl'ом
		const count = countIn(group.values, values);

		if (count < group.min || count > group.max) {
			return "invalid_range";
		}
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
 * @returns {number}
 */
function countIn(values, list) {
	let count = 0;

	for (const v of list) {
		if (values.includes(v)) count++;
	}

	return count;
}

/**
 * @param {Array<string>} values
 * @param {Array<string>} list
 * @returns {boolean}
 */
function includesOnlyOne(values, list) {
	return countIn(values, list) <= 1;
}
