import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("pictures", (table) => {
    table.boolean("is_official").defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("pictures", (table) => {
    table.dropColumn("is_official");
  });
}
