import type { Knex } from "knex"

export async function up(knex: Knex): Promise<void> {
	return knex.schema.alterTable("pictures", (table) => {
		table.text("sha256")
	})
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.alterTable("pictures", (table) => {
		table.dropColumn("sha256")
	})
}
