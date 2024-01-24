const config = {
	server: {
		port: 8000,
		url: '',
	},

	astro: {
		port: 4321,
		url: '',
	},

	bankid: {
		dev_port: 8001,
		url: '',
		client_id: '',
		client_secret: '',
		dataset: 51,
		jwt_key: 'a6a1f53c-b6c0-11ee-826e-9bcc21332a5e',
	},

	auth: {

		/**
		 * @type {import('./models/bankid').Address[]}
		 */
		addresses: [
			{
				state: 'Черкаська',
				// area: 'Чаркаський',
				city: 'Черкаси',
			}
		],
	}
};

update(config);

const local = 'http://localhost:';

if (!config.server.url) {
	config.server.url = local + config.server.port;
}

if (!config.bankid.url) {
	config.bankid.url = local + config.bankid.dev_port;
}

if (!config.astro.url) {
	config.astro.url = local + config.astro.port;
}

export const IS_DEV = get('NODE_ENV') !== 'production';
export const SERVER = config.server;
export const BANKID = config.bankid;
export const AUTH = config.auth;
export const ASTRO_URL = config.astro.url;


function update(config, prefix = '') {
	for (const key in config) {
		const value = config[key];

		if (value && typeof value === 'object') {
			update(value, prefix + key + '_');
			continue;
		}

		const env = get((prefix + key).toUpperCase());

		if (typeof env === 'undefined') continue;

		config[key] = env;
	}
}

function get(name) {
	return process.env[name] || import.meta.env[name];
}