import {resolve, } from 'node:path';
import {URL} from "node:url";
import dotenv from 'dotenv';
import {update, get} from '../lib/env.js';

const dirname = import.meta.dirname || resolve(new URL(import.meta.url).pathname, '..');

export const ROOT_DIR = resolve(dirname, '..', '..');
export const SRC_DIR = resolve(ROOT_DIR, 'src');
export const SERVER_DIR = resolve(ROOT_DIR, 'server');

dotenv.config({
	path: resolve(ROOT_DIR, '.env'),
});

export const DB_FILENAME = get('DB_FILENAME') || 'database.sqlite';

export const POLLS_DIR = (
	get('POLLS_DIR') ||
	resolve(SRC_DIR, 'polls')
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

	docs: {
		folder_id: ''
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
export const DOCS = config.docs;

