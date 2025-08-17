import db from '../db/index.js';
import pick from '../lib/pick.js';
import moment from "moment";
import axios from "axios";
import pc from "pluscodes";
import {createPublicKey, publicEncrypt, createHash} from 'crypto';
import {MAPS} from '../config/index.js';
import {STATISTIC_PUBLIC_KEY} from '../keys/index.js';

const publicKey = createPublicKey(STATISTIC_PUBLIC_KEY);

const mapApi = axios.create({
	baseURL: 'https://api.mapbox.com',
	method: 'GET',
});

/**
 * @returns {import('./statistic').StatisticBuilder}
 */
const Statistic = () => db('statistic');

export default {
	/**
	 * @param {import('./bankid').Client} user
	 * @returns {Promise<import('./statistic').StatisticData>}
	 */
	async fromBankIdUserData(user) {
		const data = pick(user, [
			'bank_id',
			'name',
			'sex',
		]);

		data.age = moment().diff(moment(user.birthDay, 'DD.MM.Y'), 'years');

		const addr = user.addresses.find(a => a.type === 'juridical');

		data.geo = await getGeoPlusCode(addr);

		return data;
	},

	/**
	 * @param {import('./statistic').StatisticData} user
	 * @param {string} poll_id
	 * @param {Array<string>} values
	 * @return {Promise<Array<{id: number}>>}
	 */
	create(user, poll_id, values) {
		return (
			Statistic()
			.insert(
				values.map(value => {
					const data = {
						...user,
						poll: poll_id,
						value,
					};

					return {
						hash: hashData(data),
						data: encryptData(data),
					};
				})
			)
			.returning('rowid')
		);
	},

	/**
	 * @param {import('./statistic').StatisticData} user
	 * @param {string} poll_id
	 * @param {Array<string>} values
	 * @return {Promise<void>}
	 */
	remove(user, poll_id, values) {
		return (
			Statistic()
			.where('hash', 'in', values.map(value => hashData({...user, poll: poll_id, value})))
			.del()
		);
	},
};

/**
 * @param {import('./bankid').Address} addr
 * @returns {Promise<string>}
 */
export async function getGeoPlusCode(addr) {
	const loc = await getLocation(addr);

	if (!loc) {
		return 'no_location';
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
			place: MAPS.place,
			street: addr.street,
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
 * @param {import('./statistic').Statistic} data
 * @returns {string} json
 */
function stringifyData(data) {
	return JSON.stringify([data.poll, data.value, data.age, data.sex, data.geo]);
}

/**
 * @param {import('./statistic').Statistic} data
 * @returns {string}
 */
export function hashData(data) {
	return (
		createHash('sha256')
		.update(stringifyData(data))
		.digest('hex')
	);
}

/**
 * @param {import('./statistic').Statistic} data
 * @returns {Buffer}
 */
export function encryptData(data) {
	return publicEncrypt(
		publicKey,
		Buffer.from(stringifyData(data))
	);
}