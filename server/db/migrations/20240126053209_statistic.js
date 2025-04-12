/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
	return knex.schema.createTable('statistic', (t) => {
		t.text('hash');
		t.text('data');

		t.index(['hash']);
	});
}

/**
 * @param { import("knex").Knex } knex
 */
export function down({schema}) {
	return schema.dropTable('statistic');
}
