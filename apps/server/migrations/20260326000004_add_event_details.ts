import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    table.string("location").nullable();
    table.datetime("event_start_time").nullable();
    table.datetime("event_end_time").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    table.dropColumn("location");
    table.dropColumn("event_start_time");
    table.dropColumn("event_end_time");
  });
}
