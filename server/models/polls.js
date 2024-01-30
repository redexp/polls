import {readFileSync} from 'fs';
import {resolve} from 'path';

const url = new URL(import.meta.url);
const json = readFileSync(resolve(url.pathname, '..', '..', 'polls_meta.json'), 'utf8');
const data = JSON.parse(json);

/**
 * @type {Map<string, {answer_type: 'dot' | 'check', values: Array<string>}>}
 */
const meta = new Map(Object.keys(data).map(name => [name, data[name]]));

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
	}
};