import {resolve} from 'path';
import {update, get} from '../lib/env.js';
import 'dotenv/config.js';

export const POLLS_META_PATH = (
	get('POLLS_META_PATH') ||
	resolve(import.meta.dirname, '..', 'polls_meta.json')
);

const config = {
	server: {
		port: 8000,
		url: '',
	},

	astro: {
		port: 4321,
		url: '',
	},

	// mapbox settings
	maps: {
		access_token: '',
		country: 'UA',
		region: 'Cherkasy Oblast', // taken from mapbox playground
		place: 'Черкаси',
	},
};

update(config);

const local = 'http://localhost:';

if (!config.server.url) {
	config.server.url = local + config.server.port;
}

if (!config.astro.url) {
	config.astro.url = local + config.astro.port;
}

export const IS_DEV = get('NODE_ENV') !== 'production';
export const SERVER = config.server;
export const MAPS = config.maps;
export const ASTRO_URL = config.astro.url;


