import Knex from "knex"
import knexfile from "../../../knexfile"

export const knex = Knex(knexfile)
