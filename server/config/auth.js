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