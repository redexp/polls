import {getJson} from '../lib/env.js';

const AUTH = {
	/** @type {import('./models/bankid').Address[]} */
	addresses: [],

	/** @type {string[]} */
	admins: [],
};

AUTH.addresses = getJson('AUTH_ADDRESSES', [
	{
		type: "factual",
		state: 'Черкаська',
		city: 'Черкаси',
	}, {
		type: "factual",
		state: 'Черкаська',
		city: 'Оршанець',
	}
]);

AUTH.admins = getJson('AUTH_ADMINS', []);

export default AUTH;