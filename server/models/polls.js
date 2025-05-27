import {POLLS_META} from '../config.js';

/**
 * @type {Map<string, {answer_type: 'dot' | 'check', values: Array<string>}>}
 */
const meta = new Map(Object.keys(POLLS_META).map(name => [name, POLLS_META[name]]));

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