export default {
	client: "better-sqlite3",
	connection: {
		filename: "./database.sqlite3",
	},
	migrations: {
		tableName: "knex_migrations",
	},
}
