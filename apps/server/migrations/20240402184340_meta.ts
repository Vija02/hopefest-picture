import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("pictures", (table) =>{
    table.integer("width")
    table.integer("height")
    table.boolean("is_cached")
  })
}


export async function down(knex: Knex): Promise<void> {
}

