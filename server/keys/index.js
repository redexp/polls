import {readFileSync} from "node:fs";
import {resolve} from 'node:path';

const read = (file, enc) => readFileSync(resolve(import.meta.dirname, file), enc)

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