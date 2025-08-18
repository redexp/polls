import {URL} from "node:url";
import {resolve} from "node:path";
import Client from "@libsql/knex-libsql";
import {SERVER_DIR, DB_FILENAME} from '../config/index.js';

const url = new URL(import.meta.url);
url.pathname = resolve(SERVER_DIR, 'db', DB_FILENAME);

export default {
	client: Client,
	connection: {
		filename: url.toString(),
	},
	useNullAsDefault: true,
};
