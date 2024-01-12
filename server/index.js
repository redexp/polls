import express from 'express';
import cors from 'cors';
import moment from 'moment';
import Answers from './models/answers.js';
import Polls from './models/polls.js';

const IS_DEV = process.env.NODE_ENV !== 'production';

const app = express();

if (IS_DEV) {
	app.use(cors({
		origin(origin, next) {
			if (origin === 'http://localhost:4321') {
				next(null, true);
			}
			else {
				next(new Error('Not allowed'));
			}
		}
	}));
}

app.use(express.json());

app.post('/answers', function (req, res, next) {
	const data = req.body;
	const page = Number(data.page);
	const limit = 50;
	const offset = (page - 1) * limit;

	res.setHeader('Access-Control-Allow-Origin', '*');

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
	const {bank_id, name, poll, value, checked = true} = req.body;

	if (
		!bank_id ||
		!name ||
		!Polls.isValid(poll, value)
	) {
		res.sendStatus(400);
		return;
	}

	const create = async () => {
		await Answers.create({bank_id, poll, value, name});
		return {is_new: true};
	};

	Answers
	.findAll({bank_id, poll})
	.then(async (items) => {
		const answer_type = Polls.getAnswerType(poll);
		const hasAnswer = items.length > 0;

		const answer = items[0];

		if (answer && moment.utc() - moment.utc(answer.created_at) > 60 * 10 * 1000) {
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
	})
	.then(function (data = true) {
		res.json(data);
	})
	.catch(next);
});

app.post('/polls-stats', function (req, res, next) {
	const {polls, bank_id} = req.body;

	Promise.all([
		Answers.getPollsStats(polls),
		Answers.getPollsValues(polls, bank_id),
	])
	.then(([stats, values]) => {
		for (const poll in stats) {
			for (const value in stats[poll]) {
				stats[poll][value].checked = values.hasOwnProperty(poll) && values[poll].includes(value);
			}
		}

		res.json(stats);
	})
	.catch(next);
});

app.use(function (err, req, res, next) {
	console.error(err);

	res.sendStatus(500);
});

const PORT = Number(process.env.APP_PORT) || 8000;

app.listen(PORT, () => {
	console.log('http://locahost:' + PORT);
});