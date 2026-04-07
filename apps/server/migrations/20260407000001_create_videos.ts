import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("videos", (table) => {
    table.increments("id").primary();
    table.string("title").notNullable();
    table.string("url").notNullable();
    table.integer("event_id").unsigned().notNullable();
    table.integer("sort_order").defaultTo(0);
    table.timestamp("created_at");
    table.timestamp("updated_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("videos");
}
