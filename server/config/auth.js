import {getJson} from '../lib/env.js';

const AUTH = {
	/** @type {import('./models/bankid').Address[]} */
	addresses: [],

	/** @type {string[]} */
	admins: [],
};

AUTH.addresses = getJson('AUTH_ADDRESSES', [
	{
		state: 'Черкаська',
		city: 'Черкаси',
	}, {
		state: 'Черкаська',
		city: 'Оршанець',
	}
]);

AUTH.admins = getJson('AUTH_ADMINS', []);

export default AUTH;