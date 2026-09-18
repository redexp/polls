import {Router} from 'express';
import BankID from '../models/bankid.js';
import {router as polls} from './polls.js';
import {router as build} from './build.js';
import {router as preview} from './preview.js';
import {errorHandler} from './errors.js';

export const router = Router({mergeParams: true});

/**
 * Сторінка /admin статична і публічна — як /map. Уся перевірка тут, і вона
 * стосується кожного ендпоінта, включно з прев'ю: адмінка пише файли і запускає
 * процес на сервері, тому пропущений middleware дорожчий, ніж на /map.
 */
router.use(function (req, res, next) {
	BankID
	.isAdmin(req.body?.jwt || bearerToken(req))
	.then(function (valid) {
		if (!valid) {
			res.sendStatus(401);
			return;
		}

		next();
	})
	.catch(next);
});

router.use('/polls', polls);
router.use(preview);
router.use(build);

/**
 * Кинутий хендлером обʼєкт з полем type стає відповіддю 400 з текстом для
 * форми. Тому хендлери — звичайні async-функції: express 5 сам ловить їхні
 * відмови й доводить сюди.
 */
router.use(errorHandler);

/**
 * Збереження опитування йде multipart, і на момент цієї перевірки тіла ще
 * немає — express.json його не розбирає. Тому для нього jwt іде в заголовку.
 * Перевірка при цьому відбувається до розбору картинок, і неавторизований
 * запит не тримає в пам'яті ні байта.
 *
 * @param {import('express').Request} req
 * @returns {string|undefined}
 */
function bearerToken(req) {
	const header = req.get('authorization') || '';
	const match = header.match(/^Bearer\s+(.+)$/i);

	return match ? match[1].trim() : undefined;
}
