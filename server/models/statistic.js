import db from '../db/index.js';
import pick from 'lodash.pick';
import moment from "moment";
import axios from "axios";
import pc from "pluscodes";
import {MAPS} from '../config.js';

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
			'sex',
		]);

		data.age = moment().diff(moment(user.birthDay, 'DD.MM.Y'), 'years');

		const addr = user.addresses.find(a => a.type === 'juridical');

		data.geo = await getGeoPlusCode(addr);

		return data;
	},

	/**
	 * @param {import('./statistic').Statistic} data
	 * @return {Promise<[{rawid: number}]>}
	 */
	create(data) {
		return (
			Statistic()
			.insert(clear(data))
			.returning('rowid')
		);
	},

	/**
	 * @param {import('./statistic').Statistic} data
	 * @param {string} newValue
	 * @return {Promise<void>}
	 */
	updateValue(data, newValue) {
		const query = (
			Statistic()
			.select('rowid')
			.where(clear(data))
			.limit(1)
		);

		if (data.value === newValue) return query;

		return (
			Statistic()
			.update({value: newValue})
			.where('rowid', 'in', query)
		);
	},
};

/**
 * @param {*} data
 * @returns {import('./statistic').Statistic}
 */
export function clear(data) {
	return pick(data, [
		'poll',
		'value',
		'age',
		'sex',
		'geo',
	]);
}

/**
 * @param {import('./bankid').Address} addr
 * @returns {Promise<string>}
 */
async function getGeoPlusCode(addr) {
	const isNA = (v) => !v || v === 'n/a';

	let codeLength = 8;
	let loc = await getLocation(toAddressString(addr));

	if (!loc && !isNA(addr.houseNo)) {
		loc = await getLocation(toAddressString({...addr, houseNo: 'n/a'}));
	}

	if (!loc && !isNA(addr.street)) {
		codeLength = 4;
		loc = await getLocation(toAddressString({...addr, street: 'n/a', houseNo: 'n/a'}));
	}

	if (!loc) {
		return 'no_location';
	}

	return pc.encode({latitude: loc.lat, longitude: loc.lng}, codeLength);
}

/**
 * @param {string} address
 * @returns {Promise<{lat: number, lng: number}>}
 */
function getLocation(address) {
	return (
		axios
		.get('https://maps.googleapis.com/maps/api/geocode/json', {
			params: {
				address,
				language: MAPS.language,
				region: MAPS.region,
				key: MAPS.api_key,
			}
		})
		.then(({data}) => {
			return (
				data?.results &&
				data.results[0] &&
				data.results[0].geometry?.location
			);
		})
	);
}

/**
 * @param {import('./bankid').Address} addr
 * @returns {string}
 */
function toAddressString(addr) {
	return (
		[[addr.state, ' область'], [addr.area, ' район'], [addr.city], [addr.street], [addr.houseNo]]
		.filter(([v]) => !!v && v !== 'n/a')
		.map(([v, p = '']) => (v + p))
		.join(', ')
	);
}