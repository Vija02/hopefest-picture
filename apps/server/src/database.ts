import Knex from "knex";
import path from "path";
import knexfile from "../../../knexfile";

// In production (compiled), __dirname is /app/apps/server/dist/apps/server/src
// In development, __dirname is /app/apps/server/src
const isProduction = process.env.NODE_ENV === "production";
const dbPath = isProduction
  ? path.resolve(__dirname, "../../../../../../db/database.sqlite3") // From dist/apps/server/src up 6 to /app/, then ../db
  : path.resolve(__dirname, "../../../db/database.sqlite3"); // From /server/src up 4 to root, then db

export const knex = Knex({
  ...knexfile,
  connection: {
    filename: dbPath,
  },
});
