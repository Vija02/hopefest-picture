import { sha256 } from "js-sha256"
import bodyParser from "body-parser"
import cors from "cors"
import express from "express"
import { v4 } from "uuid"
import { handleAdmin } from "./admin"
import { knex } from "./database"
import { cacheData } from "./cache"

const app = express()
const port = process.env.PORT || 5000
const imgBasePath = process.env.IMG_BASE_PATH

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded())

app.get("/health", (req, res) => {
	res.status(200).send("Ok")
})

app.get("/pictures", async (req, res) => {
	const data = await knex("pictures")
		.select("*")
		.where({ is_hidden: false, is_cached: true })
		.orderBy("exif_created_at", "desc")

	const formatted = data.map((x) => {
		return {
			id: x.id,
			src: `${imgBasePath}${x.file_path}`,
			size: { width: x.width, height: x.height },
			createdAt: x.created_at,
		}
	})

	res.json(formatted)
})

app.post("/duplicate-check", async (req, res) => {
	const sha256List: string[] = req.body.data

	const data = await knex("pictures")
		.select("sha256")
		.whereIn("sha256", sha256List)

	res.json(data.map((x) => x.sha256))
})

app.all("/tusd_notify", async (req, res) => {
	if (req.body.Type === "pre-create") {
		const filenameSplit = req.body.Event.Upload.MetaData.filename.split(".")
		const extension = filenameSplit[filenameSplit.length - 1]
		if (!req.body.Event.Upload.MetaData.type.startsWith("image")) {
			res.status(200).json({
				RejectUpload: true,
			})
			return
		}

		res.status(200).json({
			ChangeFileInfo: {
				ID: `${v4()}.${extension}`,
			},
		})
		return
	}

	if (req.body.Type === "post-finish") {
		await knex("pictures").insert({
			name: req.body.Event.Upload.MetaData.filename,
			file_path: req.body.Event.Upload.Storage.Key,
			is_hidden: false,
			created_at: new Date(),
			updated_at: new Date(),
		})

		await cacheData(req.body.Event.Upload.Storage.Key)

		res.status(200).json({})
		return
	}

	res.status(200).json({})
})

handleAdmin(app)

app.use(express.static("apps/web/out"))

app.listen(port, () => {
	console.log(new Date(), `Server Listening on port ${port}`)
})

function ignore() {}

process.once("SIGINT", () => {
	// Ignore further SIGINT signals whilst we're processing
	process.on("SIGINT", ignore)
	process.kill(process.pid, "SIGINT")
	process.exit(1)
})
