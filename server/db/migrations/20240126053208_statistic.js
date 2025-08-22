/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
	return knex.schema.createTable('statistic', (t) => {
		t.string('user_id', 64).notNullable(); // sha3-256(bank_id + poll)
		t.text('poll').notNullable();
		t.text('value').notNullable();
		t.integer('age');
		t.string('sex', 1); // F|M
		t.string('geo', 9); //no_loc|8GXJC3V5+

		t.index(['poll']);
		t.index(['poll', 'value']);
	});
}

/**
 * @param { import("knex").Knex } knex
 */
export function down({schema}) {
	return schema.dropTable('statistic');
}
