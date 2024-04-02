import { knex } from "./database"
import { cacheData } from "./cache"

export const runCacheJob = async () => {
	const data = await knex("pictures").select("*").where({ is_cached: null })

	for (const x of data) {
		await cacheData(x.file_path)
	}
}
