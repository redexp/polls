import axios from 'axios';
import JWT from 'jsonwebtoken';
import {promisify} from 'util';
import {randomUUID} from 'crypto';
import {BANKID as config} from '../config.js';

const jwtEncode = promisify(JWT.sign);
const jwtDecode = promisify(JWT.verify);

const {base_url, client_id, client_secret} = config;
const jwtKey = config.jwt_key;

const ajax = axios.create({
	baseURL: base_url
});

/**
 * @type {Map<string, {data: any, time: number}>}
 */
const stateMap = new Map();

export default {
	getAuthUrl(state) {
		const data = new URLSearchParams({
			response_type: 'code',
			client_id,
			dataset: config.dataset,
		});

		if (state) {
			if (typeof state === 'object') {
				const data = state;
				state = randomUUID();
				stateMap.set(state, {data, time: Date.now()});
			}

			data.set('state', state);
		}

		return base_url + '/oauth2/authorize?' + data.toString();
	},

	/**
	 * @param {string} code
	 * @param {string} [state]
	 * @return {Promise<{data: {token_type: "bearer", access_token: string, expires_in: number}, state?: any}>}
	 */
	async getAccessData(code, state) {
		const res = await ajax({
			url: '/oauth2/token',
			method: 'POST',
			headers: {'content-type': 'application/x-www-form-urlencoded'},
			data: {
				grant_type: 'authorization_code',
				client_id,
				client_secret,
				code,
			},
		});

		const data = {
			data: res.data,
		};

		if (state && stateMap.has(state)) {
			data.state = stateMap.get(state).data;
			stateMap.delete(state);
		}

		return data;
	},

	async getUserData(access_token) {
		const res = await ajax({
			url: '/resource/client',
			method: 'POST',
			headers: {
				authorization: `Bearer ${access_token}`
			},
			data: {
				cert: config.cert
			}
		});

		return res.data;
	},

	async toJWT(data) {
		return jwtEncode(data, jwtKey, {algorithm: 'HS256'});
	},

	async fromJWT(jwt) {
		if (!jwt) return null;

		return jwtDecode(jwt, jwtKey);
	}
};

setInterval(() => {
	const now = Date.now();
	const timeout = 60 * 60 * 1000;

	for (const [key, {time}] of stateMap) {
		if (now - time > timeout) {
			stateMap.delete(key);
		}
	}
}, 60 * 1000);
