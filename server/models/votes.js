import {readFileSync} from 'fs';
import {resolve} from 'path';

const url = new URL(import.meta.url);
const json = readFileSync(resolve(url.pathname, '..', '..', 'votes_meta.json'), 'utf8');
const data = JSON.parse(json);

/**
 * @type {Map<string, {answer_type: 'dot' | 'check', values: Array<string>}>}
 */
const meta = new Map(Object.keys(data).map(name => [name, data[name]]));

export default {
	isValid(vote, value) {
		const item = meta.get(vote);

		return !!(item?.values.includes(value));
	},

	getAnswerType(vote) {
		return meta.get(vote).answer_type;
	}
};