/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
	return knex.schema.createTable('archive', (t) => {
		t.text('poll');
		t.text('data');

		t.index(['poll']);
	});
}

/**
 * @param { import("knex").Knex } knex
 */
export function down({schema}) {
	return schema.dropTable('archive');
}
