import express from 'express';
import cors from 'cors';
import moment from 'moment';
import pick from 'lodash.pick';
import Answers, {ANSWER_UPDATE_TIMEOUT} from './models/answers.js';
import Polls from './models/polls.js';
import Auth from './models/auth.js';
import {IS_DEV, PORT, ASTRO_URL} from './config.js';

const app = express();

app.listen(PORT, () => {
	console.log('http://locahost:' + PORT);
});

if (IS_DEV) {
	app.use(cors({
		origin(origin, next) {
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

	const create = async () => {
		const user = await Auth.fromJWT(jwt);
		await Answers.create({...user, poll, value});
		return {is_new: true};
	};

	;(async () => {
		const user = await Auth.fromJWT(jwt).catch(() => null);

		if (
			!user ||
			!Polls.isValid(poll, value)
		) {
			res.status(400);
			return {message: `Параметри, які необхідні щоб запамʼятати вашу відповідь, є некоректними. Спробуйте перезавантажити сторінку, або ж ще раз ідентифікуйте себе через BankID.`};
		}

		const items = await Answers.findAll({bank_id: user.bank_id, poll});
		const answer_type = Polls.getAnswerType(poll);
		const hasAnswer = items.length > 0;

		const answer = items[0];

		if (answer && isExpired(answer)) {
			res.status(403);
			return {message: `Змінити свій голос можливо лише на протязі 10 хвилин`};
		}

		if (answer_type === 'dot') {
			if (hasAnswer) {
				if (checked) {
					await Answers.updateValue(answer.id, value);
				}
				else {
					await Answers.remove(answer.id);
				}
			}
			else if (checked) {
				return create();
			}
		}
		else {
			const answer = items.find(item => item.value === value);

			if (checked) {
				if (answer) return;

				return create();
			}

			if (!answer) return;

			await Answers.remove(answer.id);
		}
	})()
	.then(function (data = true) {
		res.json(data);
	})
	.catch(next);
});

app.post('/polls-stats', function (req, res, next) {
	const {polls, jwt} = req.body;

	Promise.all([
		Answers.getPollsStats(polls),
		Auth.fromJWT(jwt).then((user) => Answers.getPollsInfo(polls, user?.bank_id)),
	])
	.then(([stats, polls]) => {
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

	res.redirect(Auth.getAuthUrl(data));
});

app.get('/bankid/callback', function (req, res, next) {
	const {code, state} = req.query;

	Auth
	.getAccessData(code, state)
	.then(async function ({data, state}) {
		const user = await Auth.getUserData(data.access_token);
		const jwt = await Auth.toJWT(user);

		const qs = new URLSearchParams({jwt});
		let url = '/'

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
		const qs = new URLSearchParams();

		if (err?.context === 'auth') {
			qs.set('type', err.type);
		}

		redirect(res, '/bankid/auth-error', qs);
	});
});

app.use(function (err, req, res, next) {
	console.error(err);

	res.sendStatus(500);
});

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