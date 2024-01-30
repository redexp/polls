/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
	return knex.schema.createTable('statistic', (t) => {
		t.text('poll');
		t.text('value');
		t.integer('age');
		t.text('sex');
		t.text('geo');

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
