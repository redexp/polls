import express from 'express';
import {randomUUID} from 'crypto';
import db from './db/index.js';
import Answers, {isExpired} from './models/answers.js';
import Statistic from './models/statistic.js';
import Polls, {reloadPollsMeta} from './models/polls.js';
import BankID from './models/bankid.js';
import {IS_DEV, SERVER, ASTRO_URL} from './config/index.js';
import BANKID from './config/bankid.js';

reloadPollsMeta()
.catch(err => {
	console.error(err);
	process.exit(1);
});

const app = express();

app.listen(SERVER.port, () => {
	console.log('http://localhost:' + SERVER.port);
});

app.use(express.json());

app.post('/api/answers', async function (req, res) {
	const data = req.body;
	const page = Number(data.page);
	const limit = 50;
	const offset = (page - 1) * limit;

	if (!data.poll || !data.value) {
		res.sendStatus(400);
		return;
	}

	const {rows, count} = await Answers.findAndCount({
		where: {
			poll: String(data.poll),
			value: String(data.value),
			searchName: data.searchName,
		},
		offset,
		limit,
	});

	res.json({
		rows: rows.map(({name}, i) => ({
			name,
			number: offset + i + 1,
		})),
		pages: Math.ceil(count / limit),
	});
});

app.post('/api/answer', async function (req, res) {
	/** @type {AnswerData & {jwt: string}} */
	const data = req.body;
	const {jwt, poll_id, values} = data;

	const user = await BankID.fromJWT(jwt).catch(() => null);

	if (!user) {
		res.status(400);
		res.json({message: `Ми не можемо Вас ідентифікувати, пройдіть будь ласка ідентифікацію через BankID ще раз.`});
		return;
	}

	const valid = Polls.isValid(poll_id, values);

	if (valid !== true) {
		res.status(400);
		res.json({
			type: valid,
			message: `Параметри, які необхідні щоб запамʼятати вашу відповідь, є некоректними. Спробуйте перезавантажити сторінку.`,
		});
		return;
	}

	const items = await Answers.findAll({
		bank_id: user.bank_id,
		poll_id,
	});

	if (items.some(isExpired)) {
		res.status(403);
		res.json({message: `Змінити свій голос можливо лише на протязі 10 хвилин`});
		return;
	}

	if (items.length > 0) {
		await db.trx([
			Answers.remove(user, poll_id),
			Statistic.remove(user, poll_id, items.map(item => item.value)),
		]);
	}

	await db.trx([
		Answers.create(user, poll_id, values),
		Statistic.create(user, poll_id, values),
	]);

	res.json(true);
});

app.post('/api/polls-stats', async function (req, res) {
	const {polls: polls_ids, jwt} = req.body;

	const user = await BankID.fromJWT(jwt);

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
		),
	});
});

app.get('/api/bankid/auth', function (req, res) {
	const url = new URL(req.get('referer'));

	res.redirect(
		BankID.getAuthUrl({
			state: req.query?.state,
			return: url.pathname,
		})
	);
});

/**
 * @type {Map<string, {jwt: string, time: number}>}
 */
const jwtMap = new Map();

app.get(BANKID.callback_url, function (req, res) {
	const {code, state} = req.query;

	BankID
	.getAccessData(code, state)
	.then(async function ({data, state}) {
		const client = await BankID.getClientData(data.access_token);

		BankID.validateUserData(client);

		const auth_token = await toJwtAuthToken(client);

		const url = state?.return || '/';

		const qs = new URLSearchParams({
			auth_token,
			state: state?.state,
		});

		redirect(res, url, qs);
	})
	.catch(err => {
		console.log('BankID callback', err);

		const qs = new URLSearchParams();

		if (err?.context === 'bankid' || err?.context === 'statistic') {
			qs.set('type', err.type);
		}
		else if (err?.code === 'invalid_must_key') {
			qs.set('type', 'no_id');
		}

		redirect(res, '/bankid/auth-error', qs);
	});
});

app.post('/api/bankid/jwt', function (req, res) {
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

function redirect(res, url, qs) {
	if (IS_DEV) {
		url = ASTRO_URL + url;
	}

	if (qs) {
		url += '?' + qs.toString();
	}

	res.redirect(url);
}

/**
 * @param {import('./models/bankid').Client} client
 * @returns {Promise<string>}
 */
async function toJwtAuthToken(client) {
	const userData = await Statistic.createUserData(client);

	const jwt = await BankID.toJWT(userData);

	let uuid;

	for (let i = 0; i < 10; i++) {
		uuid = randomUUID().slice(0, 8);

		if (!jwtMap.has(uuid)) break;
	}

	jwtMap.set(uuid, {jwt, time: Date.now()});

	return uuid;
}