import {Router} from "express";
import db from './db/index.js';
import Answers, {isExpired, ANSWER_UPDATE_TIMEOUT_MIN} from './models/answers.js';
import Statistic from './models/statistic.js';
import {isPublicPoll, isValidPollValues} from './models/polls.js';
import BankID from './models/bankid.js';

export const router = Router({mergeParams: true});

router.post('/', async function (req, res) {
	/** @type {AnswerData & {jwt: string}} */
	const data = req.body;
	const {jwt, poll_id, values, texts} = data;

	const user = await BankID.fromJWT(jwt).catch(() => null);

	if (!user) {
		res.status(400);
		res.json({message: `Ми не можемо Вас ідентифікувати, пройдіть будь ласка ідентифікацію через BankID ще раз.`});
		return;
	}

	const valid = isValidPollValues(poll_id, values);

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
		res.json({message: `Змінити свій голос можливо лише протягом ${ANSWER_UPDATE_TIMEOUT_MIN} хвилин`});
		return;
	}

	if (items.length > 0) {
		await db.trx([
			Answers.remove(user, poll_id),
			Statistic.remove(user, poll_id),
		]);
	}

	if (!isPublicPoll(poll_id)) {
		user.name = null;
	}

	await db.trx([
		Answers.create(user, poll_id, values),
		Statistic.create(user, poll_id, values, texts),
	]);

	res.json(true);
});