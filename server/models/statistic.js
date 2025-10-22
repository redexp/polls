import db from '../db/index.js';
import pick from '../lib/pick.js';
import moment from "moment";
import axios from "axios";
import pc from "pluscodes";
import {createPublicKey, publicEncrypt, createHash} from 'crypto';
import {MAPS} from '../config/index.js';
import {STATISTIC_PUBLIC_KEY} from '../keys/index.js';
import authAddress from "../lib/authAddress.js";

export const NO_LOC = 'no_loc';

const publicKey = createPublicKey(STATISTIC_PUBLIC_KEY);

const mapApi = axios.create({
	baseURL: 'https://api.mapbox.com',
	method: 'GET',
});

/**
 * @returns {import('./statistic').StatisticBuilder}
 */
const Statistic = () => db('statistic');

/**
 * @returns {import('./statistic').ArchiveBuilder}
 */
const Archive = () => db('archive');

export default {
	/**
	 * @returns {import('./statistic').StatisticBuilder}
	 */
	query() {
		return Statistic();
	},

	/**
	 * @param {import('./bankid').Client} client
	 * @returns {Promise<import('./statistic').UserData>}
	 */
	async createUserData(client) {
		const user = pick(client, [
			'bank_id',
			'name',
			'sex',
		]);

		user.age = (
			client.dateOfBirth ?
				moment().diff(moment(client.dateOfBirth, 'DD.MM.Y'), 'years') :
				0
		);

		const addr = authAddress(client.addresses);

		user.geo = await getGeoPlusCode(addr);

		return user;
	},

	/**
	 * @param {import('./statistic').UserData} user
	 * @param {string} poll_id
	 * @param {Array<string>} values
	 * @param {Object<string, string>} [texts]
	 * @return {Promise<void>}
	 */
	create(user, poll_id, values, texts = {}) {
		const {bank_id, ...data} = user;
		const user_id = hashUserId(bank_id, poll_id);

		return (
			Statistic()
			.insert(
				values.map(value => ({
					...pick(data, [
						'age',
						'sex',
						'geo',
					]),
					user_id,
					poll: poll_id,
					value,
					text: texts?.hasOwnProperty(value) ? texts[value] : null
				}))
			)
		);
	},

	/**
	 * @param {import('./statistic').UserData} user
	 * @param {string} poll_id
	 * @param {Array<string>} values
	 * @return {Promise<void>}
	 */
	archive(user, poll_id, values) {
		user = {
			...user,
			user_id: hashUserId(user.bank_id, poll_id),
		};

		return (
			Archive()
			.insert(
				values.map(value => ({
					poll: poll_id,
					data: encryptData(user, value),
				}))
			)
		);
	},

	/**
	 * @param {import('./statistic').UserData} user
	 * @param {string} poll_id
	 * @return {Promise<void>}
	 */
	remove(user, poll_id) {
		const user_id = hashUserId(user.bank_id, poll_id);

		return (
			Statistic()
			.where({
				user_id,
			})
			.del()
		);
	},
};

/**
 * @param {import('./bankid').Address} addr
 * @returns {Promise<string>}
 */
export async function getGeoPlusCode(addr) {
	if (!addr) return NO_LOC;

	const loc = await getLocation(addr);

	if (!loc) {
		return NO_LOC;
	}

	return pc.encode(loc, 8);
}

/**
 * @param {import('./bankid').Address} addr
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
async function getLocation(addr) {
	if (isNA(addr.street)) {
		return null;
	}

	const {data} = await mapApi({
		url: '/search/geocode/v6/forward',
		params: {
			country: MAPS.country,
			region: MAPS.region,
			place: addr.city,
			street: addr.street.replace(/\.\s*/g, '. '),
			address_number: isNA(addr.houseNo) ? '' : addr.houseNo,
			limit: 1,
			access_token: MAPS.access_token,
		}
	});

	return data?.features?.[0]?.properties?.coordinates;
}

function isNA(v) {
	return !v || v === 'n/a';
}

/**
 * @param {string} bank_id
 * @param {string} poll_id
 * @returns {string}
 */
export function hashUserId(bank_id, poll_id) {
	return (
		createHash('sha3-256')
		.update(bank_id + '|' + poll_id)
		.digest('hex')
	);
}

/**
 * @param {import('./statistic').UserData} user
 * @param {string} value
 * @returns {Buffer}
 */
export function encryptData(user, value) {
	return publicEncrypt(
		publicKey,
		Buffer.from(
			JSON.stringify([
				user.user_id,
				value,
				user.age,
				user.sex,
				user.geo,
			])
		)
	);
}