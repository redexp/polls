import knex from 'knex';
import Client from '@libsql/knex-libsql';
import {URL} from 'url';
import {resolve} from 'path';

const url = new URL(import.meta.url);
url.pathname = resolve(url.pathname, '..', 'database.sqlite');

const db = knex({
	client: Client,
	connection: {
		filename: process.env.DB_PATH || url.toString()
	},
	useNullAsDefault: true,
});

export default db;
