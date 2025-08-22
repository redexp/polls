import {Router} from 'express';
import {polls} from './models/polls.js';
import db from './db/index.js';
import Statistic from './models/statistic.js';
import ranges from './config/age-groups.js';

export const router = Router({mergeParams: true});

router.post('/answers', async function (req, res) {
	const {poll_id} = req.body;
	const poll = polls.get(poll_id);

	const [counts] = await (
		Statistic
		.query()
		.select(
			poll.values.map((v, i) => (
				db.raw(`COUNT(CASE WHEN value = ? THEN 1 END) as value${i}`, [v])
			))
		)
		.where({
			poll: poll_id
		})
	);

	res.json(
		poll.values.map((value, i) => ({
			value,
			count: counts['value' + i],
		}))
	);
});

router.post('/counts', async function (req, res) {
	/** @type {string} */
	const poll_id = req.body.poll_id;
	/** @type {string[]} */
	const values = req.body.values;
	/** @type {string[]} */
	const sex = req.body.sex;
	/** @type {string[]} */
	const age = req.body.age;

	const poll = polls.get(poll_id);

	const valueQuery = values.length > 0 ? 'AND value IN (' + values.map(() => '?').join(',') + ')' : '';
	const valueParams = values;

	const sexQuery = sex.length > 0 ? `AND sex IN (` + sex.map(() => '?').join(',') + ')' : '';
	const sexParams = sex;

	const formatAge = ([_, to]) => (
		to ?
			'age BETWEEN ? AND ?' :
			'age >= ?'
	);

	const ageQuery = (
		age.length > 0 ?
			(
				`AND (` +
				age
				.map(formatAge)
				.join(' OR ')
				+ ')'
			) :
			''
	);
	const ageParams = age.length > 0 ? [].concat(...age) : [];

	const valuesCounts = poll.values.map((v, i) => (
		db.raw(`COUNT(CASE WHEN value = ? ${sexQuery} ${ageQuery} THEN 1 END) as value${i}`, [v, ...sexParams, ...ageParams])
	));

	const sexList = ['M', 'F'];

	const sexCounts = sexList.map((v, i) => (
		db.raw(`COUNT(DISTINCT CASE WHEN sex = ? ${valueQuery} ${ageQuery} THEN user_id END) as sex${i}`, [v, ...valueParams, ...ageParams])
	));

	const ageCounts = ranges.map((range, i) => (
		db.raw(`COUNT(DISTINCT CASE WHEN ${formatAge(range)} ${valueQuery} ${sexQuery} THEN user_id END) as age${i}`, [...range, ...valueParams, ...sexParams])
	));

	const [counts] = await (
		Statistic
		.query()
		.select(
			...valuesCounts,
			...sexCounts,
			...ageCounts,
		)
		.where({
			poll: poll_id,
		})
	);

	const result = {
		value: Object.fromEntries(
			poll.values.map((v, i) => [v, counts['value' + i]])
		),
		sex: Object.fromEntries(
			sexList.map((v, i) => [v, counts['sex' + i]])
		),
		age: Object.fromEntries(
			ranges.map((range, i) => [range.join('-'), counts['age' + i]])
		),
	};

	res.json(result);
});

router.post('/geo', async function (req, res) {
	/** @type {Filter[]} */
	const filters = req.body;

	const list = await Promise.all(
		filters.map((filter) => {
			const q = (
				Statistic
				.query()
			);

			q
			.select('geo')
			.count({count: '*'})
			.where('poll', filter.poll_id)
			.whereNot('geo', 'no_loc')

			if (filter.values.length > 0) {
				q.whereIn('value', filter.values);
			}

			if (filter.sex.length > 0) {
				q.whereIn('sex', filter.sex);
			}

			for (const range of filter.age) {
				if (range.length === 2) {
					q.whereBetween('age', range);
				}
				else {
					q.where('age', '>=', range[0]);
				}
			}

			q.groupBy('geo');

			return q;
		})
	);

	res.json(list);
});