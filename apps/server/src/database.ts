import Knex from "knex";
import path from "path";
import knexfile from "../../../knexfile";

export const knex = Knex({
  ...knexfile,
  connection: {
    filename: path.resolve(__dirname, "../../../db/database.sqlite3"),
  },
});
