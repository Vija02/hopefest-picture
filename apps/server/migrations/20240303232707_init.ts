import type { Knex } from "knex"

export async function up(knex: Knex): Promise<void> {
	return knex.schema.createTable("pictures", function (table) {
		table.increments()
		table.string("name").notNullable()
		table.string("file_path").notNullable()
		table.boolean("is_hidden")
		table.timestamps()
	})
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropTableIfExists("pictures")
}
