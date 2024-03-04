export default {
	client: "better-sqlite3",
	connection: {
		filename: "./db/database.sqlite3",
	},
	migrations: {
		directory: "./apps/server/migrations",
		tableName: "knex_migrations",
	},
}
