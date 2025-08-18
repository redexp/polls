import axios from 'axios';
import JWT from 'jsonwebtoken';
import {promisify} from 'util';
import {createHash, randomUUID} from 'crypto';
import cap from '../lib/cap.js';
import BANKID from '../config/bankid.js';
import AUTH from '../config/auth.js';
import {BANKID_CERT, JWT_KEY} from '../keys/index.js';

const jwtEncode = promisify(JWT.sign);
const jwtDecode = promisify(JWT.verify);

const {client_id, client_secret} = BANKID;

const bankApi = axios.create({
	baseURL: BANKID.url,
	method: 'POST',
});

const cryptoApi = axios.create({
	baseURL: BANKID.crypto_url,
	method: 'POST',
});

/**
 * @type {Map<string, {data: any, time: number}>}
 */
const stateMap = new Map();

export default {
	getAuthUrl(state) {
		const qs = new URLSearchParams({
			response_type: 'code',
			state: 'state',
			client_id,
			dataset: BANKID.dataset,
			originator_url: BANKID.callback_url,
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
		const res = await bankApi({
			url: '/oauth2/token',
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
	async getClientData(access_token) {
		const {data} = await bankApi({
			url: '/resource/client',
			headers: {
				authorization: `Bearer ${access_token}`
			},
			data: {
				cert: BANKID_CERT
			}
		});

		if (data.error) {
			data.code = data.code || data.error;
			data.message = data.message || data.error_description;
			throw data;
		}

		const res = await cryptoApi({
			url: '/decrypt',
			data,
		});

		/** @type {import('./bankid').Client} */
		const user = res.data;

		if (user.error) {
			throw user;
		}

		const {inn, documents = []} = user;
		const passport = (!inn || inn === 'n/a') && documents.find(item => item.type === 'passport');
		const idPassport = !passport && documents.find(item => item.type === 'idpassport');

		user.bank_id = (
			inn && inn !== 'n/a' ?
				createSHA3Hash(inn) :
			passport ?
				createSHA3Hash(passport.series + ':' + passport.number) :
			idPassport ?
				createSHA3Hash(idPassport.series + '|' + idPassport.number) :
				null
		);

		user.name = (
			[user.lastName, user.firstName, user.middleName]
			.filter(n => !!n && n !== 'n/a')
			.map(n => cap(n.trim()))
			.join(' ')
		);

		return user;
	},

	/**
	 * @param {import('./bankid').Client} user
	 * @throws {{type: import('./bankid').ValidationErrorTypes, context: "bankid"}}
	 */
	validateUserData(user) {
		if (!user.bank_id) {
			throw {type: 'no_id', context: 'bankid'};
		}

		if (!user.name) {
			throw {type: 'no_name', context: 'bankid'};
		}

		const addr = user.addresses?.find(a => a.type === 'juridical');

		if (!addr && AUTH.addresses.length > 0) {
			throw {type: 'no_juridical_address', context: 'bankid'};
		}

		if (
			AUTH.addresses.length > 0 &&
			!AUTH.addresses.some(props => {
				for (const prop in props) {
					if (props[prop].toLowerCase() !== addr[prop].toLowerCase()) return false;
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

	/**
	 * @param jwt
	 * @returns {Promise<import('./statistic').UserData|null>}
	 */
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

/**
 * @param {string} data
 * @returns {string}
 */
function createSHA3Hash(data) {
	return createHash('sha3-256').update(data).digest('hex');
}