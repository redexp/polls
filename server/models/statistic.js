import db from '../db/index.js';
import pick from '../lib/pick.js';
import moment from "moment";
import pc from "pluscodes";
import {createPublicKey, publicEncrypt, createHash} from 'crypto';
import {STATISTIC_PUBLIC_KEY} from '../keys/index.js';
import authAddress from "../lib/authAddress.js";
import getLocation from "../lib/getLocation.js";

export const NO_LOC = 'no_loc';

const publicKey = createPublicKey(STATISTIC_PUBLIC_KEY);

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

	/**
	 * @param {string} poll_id
	 * @returns {import('./statistic').StatisticBuilder}
	 */
	removeByPoll(poll_id) {
		return (
			Statistic()
			.where({poll: String(poll_id)})
			.del()
		);
	},

	/**
	 * Зашифровані рядки без опитування лишалися б сиротами, які неможливо
	 * розшифрувати в контекст — тому видаляються разом з ним.
	 *
	 * @param {string} poll_id
	 * @returns {import('./statistic').ArchiveBuilder}
	 */
	removeArchiveByPoll(poll_id) {
		return (
			Archive()
			.where({poll: String(poll_id)})
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