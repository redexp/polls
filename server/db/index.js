import knex from 'knex';
import config from './knexfile.js';

const db = knex(config);

db.trx = function (queries) {
	return db.transaction(trx => Promise.all(queries.map(q => q.transacting(trx))));
};

export default db;