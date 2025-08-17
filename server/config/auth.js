import {get} from '../lib/env.js';

const AUTH = {

	/**
	 * @type {import('./models/bankid').Address[]}
	 */
	addresses: [],
};

const json = get('AUTH_ADDRESSES');

AUTH.addresses = (
	json ?
		JSON.parse(json) :
		[{
			state: 'Черкаська',
			city: 'Черкаси',
		}]
);

export default AUTH;

/**
 * @returns {Array<string>}
 */
export function formatAddresses() {
	return (
		AUTH.addresses
		.map(addr =>
			[['м. ', addr.city], [addr.area, ' район'], [addr.state, ' область']]
			.filter(([a, b]) => !!a && !!b)
			.map(([v, s]) => v + s)
			.join(', ')
		)
	);
}