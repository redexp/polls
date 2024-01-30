/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
	return knex.schema.createTable('answers', (t) => {
		t.increments('id');
		t.text('poll').notNullable();
		t.text('value').notNullable();
		t.text('bank_id').notNullable();
		t.text('name').notNullable();
		t.datetime('created_at').defaultTo(knex.raw(`(datetime('now'))`));

		t.index(['poll']);
		t.index(['poll', 'value']);
	});
}

/**
 * @param { import("knex").Knex } knex
 */
export function down({schema}) {
	return schema.dropTable('answers');
}
