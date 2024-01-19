import {resolve} from "path";

const url = new URL(import.meta.url);

const config = {
	port: 8000,

	astro_port: 4321,

	bankid: {
		dev_port: 8001,
		base_url: '',
		client_id: '',
		client_secret: '',
		dataset: 51,
		jwt_key: 'a6a1f53c-b6c0-11ee-826e-9bcc21332a5e',
	}
};

env(config);

if (!config.bankid.base_url) {
	config.bankid.base_url = 'http://localhost:' + config.bankid.dev_port;
}

export default config;

export const IS_DEV = process.env.NODE_ENV !== 'production';
export const PORT = Number(config.port);
export const BANKID = config.bankid;
export const ASTRO_URL = 'http://localhost:' + config.astro_port;


function env(config, prefix = '') {
	for (const key in config) {
		const value = config[key];

		if (value && typeof value === 'object') {
			env(value, prefix + key + '_');
			continue;
		}

		const prop = (prefix + key).toUpperCase();

		if (!process.env.hasOwnProperty(prop)) continue;

		config[key] = process.env[prop];
	}
}