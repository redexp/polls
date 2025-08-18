import knex from 'knex';
import Client from "@libsql/knex-libsql";
import {resolve} from 'path';
import {readFileSync} from 'fs';
import {createPrivateKey, privateDecrypt} from 'crypto';
import minimist from 'minimist';

const cwd = process.cwd();
const args = minimist(process.argv.slice(2));

const keyPath = args['key'];
let inputPath = args['input-db'] || 'server/db/database.sqlite';
let outputPath = args['output-db'] || 'decrypted-statistic.sqlite';

if (!keyPath) {
	console.error('--key is required with path to statistic private key');
	process.exit(1);
}

inputPath = resolve(cwd, inputPath);
outputPath = resolve(cwd, outputPath);

if (outputPath === inputPath) {
	console.error('path to output db sqlite file is equal to input db file path');
	process.exit(1);
}

const privateKey = createPrivateKey(readFileSync(keyPath, 'utf-8'));

const inputDB = knex({
	client: Client,
	connection: {
		filename: 'file://' + inputPath,
	},
	useNullAsDefault: true,
});

const outputDB = knex({
	client: Client,
	connection: {
		filename: 'file://' + outputPath,
	},
	useNullAsDefault: true,
});

/**
 * @param {string} data
 * @returns {import('../server/models/statistic').StatisticValues}
 */
function decrypt(data) {
	const json = privateDecrypt(privateKey, data).toString();

	return JSON.parse(json);
}

const has = await outputDB.schema.hasTable('statistic');

if (has) {
	await outputDB.schema.dropTable('statistic');
}

await outputDB.schema.createTable('statistic', function (t) {
	t.text('poll');
	t.text('value');
	t.integer('age');
	t.text('sex');
	t.text('geo');

	t.index(['poll']);
	t.index(['poll', 'value']);
});

const source = () => inputDB('statistic');
const target = () => outputDB('statistic');
const getCount = (db) => db.count({count: '*'}).then(rows => rows[0].count);

const count = await getCount(source());
const limit = 500;

for (let i = 0; i < count; i+=limit) {
	const rows = await source().select('data').orderBy('rowid').offset(i).limit(limit);

	await target().insert(rows.map(({data}) => {
		const values = decrypt(data);

		return {
			poll: values[0],
			value: values[1],
			age: values[2],
			sex: values[3],
			geo: values[4],
		};
	}));
}

const total = await getCount(target());

console.log('decrypted %d rows', total);

process.exit();