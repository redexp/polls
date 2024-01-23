import axios from 'axios';
import JWT from 'jsonwebtoken';
import {promisify} from 'util';
import {createHash, randomUUID} from 'crypto';
import pick from 'lodash.pick';
import moment from "moment";
import {BANKID, AUTH} from '../config.js';

const jwtEncode = promisify(JWT.sign);
const jwtDecode = promisify(JWT.verify);

const {client_id, client_secret, jwt_key} = BANKID;

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
	 * @return {Promise<import('./bankid').MinClientData>}
	 */
	async getUserData(access_token) {
		const res = await ajax({
			url: '/resource/client',
			method: 'POST',
			headers: {
				authorization: `Bearer ${access_token}`
			},
			data: {
				cert: BANKID.cert
			}
		});

		/**
		 * @type {import('./bankid').Client}
		 */
		const data = res.data;

		const addr = data.addresses.find(a => a.type === 'juridical');

		if (!addr && AUTH.addresses.length > 0) {
			throw {type: 'no_juridical_address', context: 'auth'};
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
			throw {type: 'invalid_address', context: 'auth'};
		}

		/**
		 * @type {import('./bankid').MinClientData}
		 */
		const user = pick(data, [
			'sex',
		]);

		user.bank_id = createSHA3Hash(data.inn);
		user.name = [data.lastName, data.firstName, data.middleName].filter(n => !!n && n !== 'n/a').join(' ');
		user.age = moment().diff(moment(data.birthDay, 'DD.MM.Y'), 'years');

		return user;
	},

	async toJWT(data) {
		return jwtEncode(data, jwt_key, {algorithm: 'HS256'});
	},

	async fromJWT(jwt) {
		if (!jwt) return null;

		return jwtDecode(jwt, jwt_key);
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