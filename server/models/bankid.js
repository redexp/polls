import axios from 'axios';
import JWT from 'jsonwebtoken';
import {promisify} from 'util';
import {createHash, randomUUID} from 'crypto';
import {BANKID, AUTH, JWT_KEY} from '../config.js';

const jwtEncode = promisify(JWT.sign);
const jwtDecode = promisify(JWT.verify);

const {client_id, client_secret} = BANKID;

const ajax = axios.create({
	baseURL: BANKID.url
});

/**
 * @type {Map<string, {data: any, time: number}>}
 */
const stateMap = new Map();

export default {
	getAuthUrl(state) {
		const qs = new URLSearchParams({
			response_type: 'code',
			client_id,
			dataset: BANKID.dataset,
		});

		if (state) {
			if (typeof state === 'object') {
				const data = state;
				state = randomUUID();
				stateMap.set(state, {data, time: Date.now()});
			}

			qs.set('state', state);
		}

		return BANKID.url + '/oauth2/authorize?' + qs.toString();
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

	/**
	 * @param {string} access_token
	 * @return {Promise<import('./bankid').Client>}
	 */
	async getUserData(access_token) {
		const {data} = await ajax({
			url: '/resource/client',
			method: 'POST',
			headers: {
				authorization: `Bearer ${access_token}`
			},
			data: {
				cert: BANKID.cert
			}
		});

		data.bank_id = data.inn && data.inn !== 'n/a' ? createSHA3Hash(data.inn) : null;
		data.name = [data.lastName, data.firstName, data.middleName].filter(n => !!n && n !== 'n/a').join(' ');

		return data;
	},

	/**
	 * @param {import('./bankid').Client} data
	 * @throws {{type: import('./bankid').ValidationErrorTypes, context: "bankid"}}
	 */
	validateUserData(data) {
		if (!data.bank_id) {
			throw {type: 'no_id', context: 'bankid'};
		}

		if (!data.name) {
			throw {type: 'no_name', context: 'bankid'};
		}

		const addr = data.addresses?.find(a => a.type === 'juridical');

		if (!addr && AUTH.addresses.length > 0) {
			throw {type: 'no_juridical_address', context: 'bankid'};
		}

		if (
			AUTH.addresses.length > 0 &&
			!AUTH.addresses.some(props => {
				for (const prop in props) {
					if (props[prop] !== addr[prop]) return false;
				}

				return true;
			})
		) {
			throw {type: 'invalid_address', context: 'bankid'};
		}
	},

	async toJWT(data) {
		return jwtEncode(data, JWT_KEY, {algorithm: 'HS256'});
	},

	async fromJWT(jwt) {
		if (!jwt) return null;

		return jwtDecode(jwt, JWT_KEY);
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

function createSHA3Hash(data) {
	return createHash('sha3-256').update(data).digest('hex');
}