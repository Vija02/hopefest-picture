import type { Knex } from "knex"

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable("pictures", (table) => {
		table.dateTime("exif_created_at")
	})
}

export async function down(knex: Knex): Promise<void> {}
