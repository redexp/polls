import db from '../db/index.js';
import pick from 'lodash.pick';

/**
 * @returns {import('./statistic').StatisticBuilder}
 */
const Statistic = () => db('statistic');

export default {
	/**
	 * @param {import('./statistic').Statistic} data
	 * @return {Promise<[{rawid: number}]>}
	 */
	create(data) {
		return (
			Statistic()
			.insert(clear(data))
			.returning('rowid')
		);
	},

	/**
	 * @param {import('./statistic').Statistic} data
	 * @param {string} newValue
	 * @return {Promise<void>}
	 */
	updateValue(data, newValue) {
		const query = (
			Statistic()
			.select('rowid')
			.where(clear(data))
			.limit(1)
		);

		if (data.value === newValue) return query;

		return (
			Statistic()
			.update({value: newValue})
			.where('rowid', 'in', query)
		);
	},
};

/**
 * @param {*} data
 * @returns {import('./statistic').Statistic}
 */
export function clear(data) {
	return pick(data, [
		'poll',
		'value',
		'age',
		'sex',
		'geo',
	]);
}