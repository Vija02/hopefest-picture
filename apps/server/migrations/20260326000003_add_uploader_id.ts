import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("pictures", (table) => {
    table.string("uploader_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("pictures", (table) => {
    table.dropColumn("uploader_id");
  });
}
