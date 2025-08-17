import {POLLS_DIR} from '../config/index.js';
import {readdir, readFile} from "node:fs/promises";
import {resolve, basename} from 'node:path';

/**
 * @typedef {{type: 'checkbox'|'radio', values: Set<string>}} ValuesGroup
 * @typedef {{id: string, values: Set<string>, groups: Array<ValuesGroup>}} PollMeta
 */

/** @type {Map<string, PollMeta>} */
const polls = new Map();

export default {
	/**
	 * @param {string} poll_id
	 * @param {Array<string>} values
	 * @returns {boolean}
	 */
	isValid(poll_id, values) {
		if (
			!poll_id ||
			!Array.isArray(values) ||
			values.length === 0
		) {
			return false;
		}

		const poll = polls.get(poll_id);

		if (!poll) return false;

		const set = new Set(values);

		if (set.difference(poll.values).size > 0) return false;

		for (const group of poll.groups) {
			if (group.type !== 'radio') continue;

			if (group.values.intersection(set).size > 1) return false;
		}

		return true;
	},

	/**
	 * @param {string} poll
	 * @return {'dot' | 'check'}
	 */
	getAnswerType(poll) {
		return polls.get(poll).answer_type;
	},
};

export async function reloadPollsMeta() {
	polls.clear();

	const list = await readdir(POLLS_DIR, {recursive: true});

	for (const filepath of list) {
		if (!filepath.endsWith('.md')) continue;

		const poll = {
			id: basename(filepath, '.md'),
			values: new Set(),
			groups: [],
		};

		if (polls.has(poll.id)) {
			throw {
				type: 'poll_duplicate',
				file: filepath,
			};
		}

		const md = await readFile(resolve(POLLS_DIR, filepath), 'utf8');

		let group = {
			type: '',
			values: new Set(),
		};

		md.replace(/^\s*(---|[\[\(]).*$/gm, function (line, mode) {
			if (mode === '---') {
				if (!group.type) return line;

				poll.groups.push(group);

				group = {
					type: '',
					values: new Set(),
				};

				return line;
			}

			const type = mode === '[' ? 'checkbox' : 'radio';
			const match = line.trim().match(
				type === 'checkbox' ?
					/^\[([^\]]+)\]/ :
					/^\(([^\)]+)\)/
			);
			const value = match && match[1].trim();

			if (!match) {
				throw {
					type: 'invalid_closing_bracket',
					file: filepath,
					line,
				};
			}

			if (!value) {
				throw {
					type: 'empty_value',
					file: filepath,
					line,
				};
			}

			if (poll.values.has(value)) {
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
			group.values.add(value);
			poll.values.add(value);
		});

		if (group.type !== '' && !poll.groups.includes(group)) {
			poll.groups.push(group);
		}

		polls.set(poll.id, poll);
	}

	return polls;
}