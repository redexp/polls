import {Router} from 'express';
import BankID from '../models/bankid.js';
import {router as polls} from './polls.js';
import {router as build} from './build.js';
import {router as preview} from './preview.js';

export const router = Router({mergeParams: true});

/**
 * Сторінка /admin статична і публічна — як /map. Уся перевірка тут, і вона
 * стосується кожного ендпоінта, включно з прев'ю: адмінка пише файли і запускає
 * процес на сервері, тому пропущений middleware дорожчий, ніж на /map.
 */
router.use(function (req, res, next) {
	BankID
	.isAdmin(req.body?.jwt)
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
