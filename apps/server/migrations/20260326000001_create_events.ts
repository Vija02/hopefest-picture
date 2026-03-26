import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("events", function (table) {
    table.increments();
    table.string("name").notNullable();
    table.string("slug").notNullable().unique();
    table.dateTime("start_time").notNullable();
    table.dateTime("end_time").notNullable();
    table.timestamps();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("events");
}
