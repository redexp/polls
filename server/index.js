import express from 'express';
import cors from 'cors';
import moment from 'moment';
import {randomUUID} from 'crypto';
import db from './db/index.js';
import Answers, {ANSWER_UPDATE_TIMEOUT} from './models/answers.js';
import Statistic from './models/statistic.js';
import Polls from './models/polls.js';
import BankID from './models/bankid.js';
import {IS_DEV, SERVER, ASTRO_URL} from './config.js';

const app = express();

app.listen(SERVER.port, () => {
	console.log(SERVER.url);
});

if (IS_DEV) {
	app.use(cors({
		origin(_origin, next) {
			next(null, true);
		}
	}));
}

app.use(express.json());

app.post('/answers', function (req, res, next) {
	const data = req.body;
	const page = Number(data.page);
	const limit = 50;
	const offset = (page - 1) * limit;

	if (!data.poll || !data.value) {
		res.sendStatus(400);
		return;
	}

	Answers
	.findAndCount({
		where: {
			poll: String(data.poll),
			value: String(data.value),
			searchName: data.searchName,
		},
		offset,
		limit,
	})
	.then(function ({rows, count}) {
		res.json({
			rows: rows.map(({name}, i) => ({
				name,
				number: offset + i + 1,
			})),
			pages: Math.ceil(count / limit),
		});
	})
	.catch(next);
});

app.post('/answer', function (req, res, next) {
	const {jwt, poll, value, checked = true} = req.body;

	;(async () => {
		const user = await BankID.fromJWT(jwt).catch(() => null);

		if (
			!user ||
			!Polls.isValid(poll, value)
		) {
			res.status(400);
			return {message: `Параметри, які необхідні щоб запамʼятати вашу відповідь, є некоректними. Спробуйте перезавантажити сторінку, або ж ще раз ідентифікуйте себе через BankID.`};
		}

		const create = async () => {
			await db.trx([
				Answers.create({...user, poll, value}),
				Statistic.create({...user, poll, value}),
			]);

			return {is_new: true};
		};

		const items = await Answers.findAll({bank_id: user.bank_id, poll});
		const answer_type = Polls.getAnswerType(poll);
		const hasAnswer = items.length > 0;

		const answer = items[0];

		if (items.some(isExpired)) {
			res.status(403);
			return {message: `Змінити свій голос можливо лише на протязі 10 хвилин`};
		}

		if (answer_type === 'dot') {
			if (hasAnswer) {
				if (checked) {
					await db.trx([
						Answers.updateValue(answer.id, value),
						Statistic.remove({...user, ...answer}),
						Statistic.create({...user, ...answer, value}),
					]);
				}
				else {
					await db.trx([
						Answers.remove(answer.id),
						Statistic.remove({...user, ...answer}),
					]);
				}
			}
			else if (checked) {
				return create(user);
			}
		}
		else {
			const answer = items.find(item => item.value === value);

			if (checked) {
				if (answer) return;

				return create(user);
			}

			if (!answer) return;

			await db.trx([
				Answers.remove(answer.id),
				Statistic.remove({...user, ...answer}),
			]);
		}
	})()
	.then(function (data = true) {
		res.json(data);
	})
	.catch(next);
});

app.post('/polls-stats', function (req, res, next) {
	const {polls: polls_ids, jwt} = req.body;

	BankID.fromJWT(jwt)
	.then(async (user) => {
		const [polls, stats] = await Answers.getPollsInfoAndStats(polls_ids, user?.bank_id);

		for (const id in stats) {
			const poll = polls.get(id);

			for (const value in stats[id]) {
				stats[id][value].checked = !!poll && poll.values.includes(value);
			}
		}

		res.json({
			stats,
			disabled: (
				Array.from(polls)
				.filter(([_, poll]) => isExpired(poll))
				.map(([id]) => id)
			)
		});
	})
	.catch(next);
});

app.get('/bankid/auth', function (req, res) {
	const {poll, value, checked = '', poll_page} = req.query;

	let data;

	if (Polls.isValid(poll, value)) {
		data = {poll, value, checked, poll_page};
	}

	res.redirect(BankID.getAuthUrl(data));
});

/**
 * @type {Map<string, {jwt: string, time: number}>}
 */
const jwtMap = new Map();

app.get('/bankid/callback', function (req, res) {
	const {code, state} = req.query;

	BankID
	.getAccessData(code, state)
	.then(async function ({data, state}) {
		const user = await BankID.getUserData(data.access_token);

		BankID.validateUserData(user);

		const statisticData = await Statistic.fromBankIdUserData(user);

		const jwt = await BankID.toJWT({
			bank_id: user.bank_id,
			name: user.name,
			...statisticData,
		});
		const uuid = randomUUID().slice(0, 8);

		jwtMap.set(uuid, {jwt, time: Date.now()});

		const qs = new URLSearchParams({auth_token: uuid});
		let url = '/';

		if (Polls.isValid(state?.poll, state?.value)) {
			if (state.poll_page) {
				url = '/polls/' + state.poll;
			}
			else {
				qs.set('poll', state.poll);
			}

			qs.set('value', state.value);
			qs.set('checked', state.checked || '');
		}

		redirect(res, url, qs);
	})
	.catch(err => {
		console.log('BankID callback', err);

		const qs = new URLSearchParams();

		if (err?.context === 'bankid' || err?.context === 'statistic') {
			qs.set('type', err.type);
		}

		redirect(res, '/bankid/auth-error', qs);
	});
});

app.post('/bankid/jwt', function (req, res) {
	const {auth_token: uuid} = req.body;

	if (!uuid || !jwtMap.has(uuid)) {
		res.json(null);
		return;
	}

	res.json({jwt: jwtMap.get(uuid).jwt});

	jwtMap.delete(uuid);
});

app.use(function (err, _req, res, _next) {
	console.error(err);

	res.sendStatus(500);
});

setInterval(() => {
	if (jwtMap.size === 0) return;

	const now = Date.now();

	for (const [key, {time}] of jwtMap.entries()) {
		if (now - time > 10_000) {
			jwtMap.delete(key);
		}
	}
}, 1000);

function isExpired({created_at}) {
	return moment.utc() - moment.utc(created_at) > ANSWER_UPDATE_TIMEOUT;
}

function redirect(res, url, qs) {
	if (IS_DEV) {
		url = ASTRO_URL + url;
	}

	if (qs) {
		url += '?' + qs.toString();
	}

	res.redirect(url);
}