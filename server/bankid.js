import {randomUUID} from 'crypto';
import config from './config/bankid.js';
import BankID from "./models/bankid.js";
import Statistic from "./models/statistic.js";
import {Router} from "express";
import {ASTRO_URL, IS_DEV} from "./config/index.js";

export const router = Router({mergeParams: true});

/**
 * @type {Map<string, {jwt: string, time: number}>}
 */
const jwtCache = new Map();

setInterval(clearJwtCache, 1000);

router.get(config.callback_url, function (req, res) {
	const {code, state} = req.query;

	BankID
	.getAccessData(code, state)
	.then(async function ({data, state}) {
		const client = await BankID.getClientData(data.access_token);

		BankID.validateUserData(client, state.dataset);

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

const api = Router({mergeParams: true});

router.use('/api/bankid', api);

api.get('/auth', function (req, res) {
	const url = new URL(req.get('referer'));

	res.redirect(
		BankID.getAuthUrl({
			state: req.query?.state,
			return: url.pathname,
			dataset: req.query.d
		})
	);
});

api.post('/jwt', function (req, res) {
	const {auth_token: uuid} = req.body;

	if (!uuid || !jwtCache.has(uuid)) {
		res.json(null);
		return;
	}

	res.json({jwt: jwtCache.get(uuid).jwt});

	jwtCache.delete(uuid);
});

api.post('/is-admin', async function (req, res) {
	res.json(await BankID.isAdmin(req.body.jwt));
});

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

		if (!jwtCache.has(uuid)) break;
	}

	jwtCache.set(uuid, {jwt, time: Date.now()});

	return uuid;
}

function clearJwtCache() {
	if (jwtCache.size === 0) return;

	const now = Date.now();

	for (const [key, {time}] of jwtCache.entries()) {
		if (now - time > 10_000) {
			jwtCache.delete(key);
		}
	}
}