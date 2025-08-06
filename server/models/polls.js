import {POLLS_META_PATH} from '../config';
import {readFileSync} from "fs";

/**
 * @type {Map<string, {answer_type: 'dot' | 'check', values: Array<string>}>}
 */
const meta = new Map();

reloadPollsMeta();

export default {
	isValid(poll, value) {
		if (!poll) return false;

		const item = meta.get(poll);

		return !!(item?.values.includes(value));
	},

	/**
	 * @param {string} poll
	 * @return {'dot' | 'check'}
	 */
	getAnswerType(poll) {
		return meta.get(poll).answer_type;
	},
};

export function reloadPollsMeta() {
	const data = JSON.parse(readFileSync(POLLS_META_PATH, 'utf-8'));

	meta.clear();

	for (const [key, value] of Object.entries(data)) {
		meta.set(key, value);
	}
}