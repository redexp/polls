import knex from 'knex';
import Client from '@libsql/knex-libsql';
import {URL} from 'url';
import {resolve} from 'path';

const url = new URL(import.meta.url);
url.pathname = resolve(url.pathname, '..', process.env.DB_PATH || 'database.sqlite');

const db = knex({
	client: Client,
	connection: {
		filename: url.toString()
	},
	useNullAsDefault: true,
});

export default db;
