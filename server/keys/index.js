import {readFileSync} from "node:fs";
import {resolve} from 'node:path';
import {SERVER_DIR} from '../config/index.js';

const KEYS_DIR = resolve(SERVER_DIR, 'keys');

const read = (file, enc) => readFileSync(resolve(KEYS_DIR, file), enc);

export const JWT_KEY = (
	process.env.JWT_KEY ||
	read('jwt.key', 'utf-8')
);

export const STATISTIC_PUBLIC_KEY = (
	process.env.STATISTIC_PUBLIC_KEY ||
	read('statistic_public_key.pem', 'utf-8')
);

export const BANKID_CERT = (
	process.env.STATISTIC_PUBLIC_KEY ||
	read('bankid.cer').toString('base64')
);

export const GOOGLE_SERVICE_ACCOUNT = (
	process.env.GOOGLE_SERVICE_ACCOUNT ||
	resolve(KEYS_DIR, 'service_account.json')
);