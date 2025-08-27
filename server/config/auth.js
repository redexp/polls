import {getJson} from '../lib/env.js';

const AUTH = {
	/** @type {import('./models/bankid').Address[]} */
	addresses: [],

	/** @type {string[]} */
	admins: [],
};

AUTH.addresses = getJson('AUTH_ADDRESSES', [{
	state: 'Черкаська',
	city: 'Черкаси',
}]);

AUTH.admins = getJson('AUTH_ADMINS', []);



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