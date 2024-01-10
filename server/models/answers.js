import db from '../db/index.js';

/**
 * @returns {import('./answer').AnswersBuilder}
 */
const Answers = () => db('answers');

export default {
	/**
	 * @param {string} [vote]
	 * @param {string} [value]
	 * @param {string} [searchName]
	 * @param {number} offset
	 * @param {number} limit
	 * @return {Promise<{rows: import('./answer').Answer[], count: number}>}
	 */
	async findAndCount({where: {vote, value, searchName}, offset, limit}) {
		const builder = Answers();

		if (vote) {
			builder.where({vote});
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
	 * @param {string} vote
	 * @return {Promise<import('./answer').Answer[]>}
	 */
	async findAll({bank_id, vote}) {
		return (
			Answers()
			.select('*')
			.where({
				bank_id: String(bank_id),
				vote: String(vote),
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
			.insert(pick(answer, ['bank_id', 'name', 'vote', 'value']), ['id'])
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
	 * @param {Array<string>} votes
	 * @return {Promise<{[vote: string]: {[value: string]: {count: number, percent: number, winner: boolean}}}>}
	 */
	async getVotesStats(votes) {
		if (!Array.isArray(votes) || votes.length === 0) return {};

		return (
			Answers()
			.select('vote', 'value', db.raw('count(*) as count'))
			.whereIn('vote', votes)
			.groupBy('vote', 'value')
			.then(rows => {
				const totals = {};
				const max = {};

				for (const {vote, count} of rows) {
					if (!totals.hasOwnProperty(vote)) {
						totals[vote] = 0;
						max[vote] = 0;
					}

					totals[vote] += count;

					if (max[vote] < count) {
						max[vote] = count;
					}
				}

				const stats = {};

				for (const {vote, value, count} of rows) {
					if (!stats.hasOwnProperty(vote)) {
						stats[vote] = {};
					}

					const total = totals[vote];

					stats[vote][value] = {
						count,
						percent: Number((count * 100 / total).toFixed(2)),
						winner: max[vote] === count,
					};
				}

				return stats;
			})
		);
	},

	/**
	 * @param {Array<string>} votes
	 * @param {string} bank_id
	 * @return {Promise<{[vote: string]: Array<string>}>}
	 */
	async getVotesValues(votes, bank_id) {
		if (!Array.isArray(votes) || votes.length === 0 || !bank_id) return {};

		return (
			Answers()
			.select('vote', 'value')
			.whereIn('vote', votes)
			.andWhere({bank_id})
			.then(rows => {
				const values = {};

				for (const {vote, value} of rows) {
					if (!values.hasOwnProperty(vote)) {
						values[vote] = [];
					}

					values[vote].push(value);
				}

				return values;
			})
		);
	},
}

function cap(word) {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * @param {import('./answer').Answer} src
 * @param {import('./answer').AnswerProps} props
 * @return {Partial<import('./answer').Answer>}
 */
function pick(src, props) {
	const data = {};

	for (const prop of props) {
		data[prop] = src[prop];
	}

	return data;
}

/**
 * @param {import('./answer').Answer} data
 * @param {import('./answer').AnswerProps} props
 * @return {Partial<import('./answer').Answer>}
 */
function omit(data, props) {
	data = {...data};

	for (const prop of props) {
		delete data[prop];
	}

	return data;
}