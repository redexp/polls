import db from '../db/index.js';
import pick from 'lodash.pick';

export const ANSWER_UPDATE_TIMEOUT = 60 * 10 * 1000; // 10 min

/**
 * @returns {import('./answer').AnswersBuilder}
 */
const Answers = () => db('answers');

export default {
	/**
	 * @param {string} [poll]
	 * @param {string} [value]
	 * @param {string} [searchName]
	 * @param {number} offset
	 * @param {number} limit
	 * @return {Promise<{rows: import('./answer').Answer[], count: number}>}
	 */
	async findAndCount({where: {poll, value, searchName}, offset, limit}) {
		const builder = Answers();

		if (poll) {
			builder.where({poll});
		}

		if (value) {
			builder.where({value});
		}

		if (searchName) {
			const words = String(searchName).trim().split(/\s+/).filter(w => !!w);
			const lower = words.map(w => w + '%').join(' ');
			const upper = words.map(w => cap(w) + '%').join(' ');
			const surname = words.length === 1 ? '% ' + cap(words[0]) + '%' : '';

			builder.andWhere(b => {
				if (lower) {
					b.whereLike('name', lower);
				}

				if (upper !== lower) {
					b.orWhereLike('name', upper);
				}

				if (surname) {
					b.orWhereLike('name', surname);
				}
			});
		}

		const [rows, count] = await Promise.all([
			builder.clone()
			.select('*')
			.offset(offset)
			.limit(limit),

			builder.clone().count({count: '*'}),
		]);

		return {
			rows,
			count: count[0].count
		};
	},

	/**
	 * @param {string} bank_id
	 * @param {string} poll
	 * @return {Promise<import('./answer').Answer[]>}
	 */
	async findAll({bank_id, poll}) {
		return (
			Answers()
			.select('*')
			.where({
				bank_id: String(bank_id),
				poll: String(poll),
			})
		);
	},

	/**
	 *
	 * @param {Omit<import('./answer').Answer, 'id' | 'created_at'>} answer
	 * @return {Promise<{id: number}>}
	 */
	async create(answer) {
		return (
			Answers()
			.insert(pick(answer, ['bank_id', 'name', 'age', 'sex', 'poll', 'value']), ['id'])
			.then(rows => rows[0])
		);
	},

	/**
	 * @param {number} id
	 * @param {string} value
	 * @return {Promise<any>}
	 */
	async updateValue(id, value) {
		return (
			Answers()
			.update({value: String(value)})
			.where({id})
		);
	},

	/**
	 * @param {number} id
	 * @return {Promise<any>}
	 */
	async remove(id) {
		return (
			Answers()
			.del()
			.where({id})
		);
	},

	/**
	 * @param {Array<string>} polls
	 * @return {Promise<{[poll: string]: {[value: string]: {count: number, percent: number, winner: boolean}}}>}
	 */
	async getPollsStats(polls) {
		if (!Array.isArray(polls) || polls.length === 0) return {};

		return (
			Answers()
			.select('poll', 'value', db.raw('count(*) as count'))
			.whereIn('poll', polls)
			.groupBy('poll', 'value')
			.then(rows => {
				const totals = {};
				const max = {};

				for (const {poll, count} of rows) {
					if (!totals.hasOwnProperty(poll)) {
						totals[poll] = 0;
						max[poll] = 0;
					}

					totals[poll] += count;

					if (max[poll] < count) {
						max[poll] = count;
					}
				}

				const stats = {};

				for (const {poll, value, count} of rows) {
					if (!stats.hasOwnProperty(poll)) {
						stats[poll] = {};
					}

					const total = totals[poll];

					stats[poll][value] = {
						count,
						percent: Number((count * 100 / total).toFixed(2)),
						winner: max[poll] === count,
					};
				}

				return stats;
			})
		);
	},

	/**
	 * @param {Array<string>} polls
	 * @param {string} bank_id
	 * @return {Promise<Map<string, {values: Array<string>, created_at: string}>>}
	 */
	async getPollsInfo(polls, bank_id) {
		if (!Array.isArray(polls) || polls.length === 0 || !bank_id) {
			return new Map();
		}

		return (
			Answers()
			.select('poll', 'value', 'created_at')
			.whereIn('poll', polls)
			.andWhere({bank_id})
			.then(rows => {
				const polls = new Map();

				for (const {poll, value, created_at} of rows) {
					if (!polls.has(poll)) {
						polls.set(poll, {
							values: [],
							created_at,
						});
					}

					const item = polls.get(poll);

					item.values.push(value);

					if (item.created_at > created_at) {
						item.created_at = created_at;
					}
				}

				return polls;
			})
		);
	},
}

function cap(word) {
	return word.charAt(0).toUpperCase() + word.slice(1);
}