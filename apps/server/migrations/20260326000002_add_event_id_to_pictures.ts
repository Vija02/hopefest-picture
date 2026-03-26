import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("pictures", (table) => {
    table.integer("event_id").unsigned();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("pictures", (table) => {
    table.dropColumn("event_id");
  });
}
