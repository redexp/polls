import data from '../polls_meta.json' with {type: 'json'};

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
	},
};