import bodyParser from "body-parser"
import cors from "cors"
import express from "express"
import Knex from "knex"
import knexfile from "../../../knexfile"
import { v4 } from "uuid"

const knex = Knex(knexfile)

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(bodyParser.json())

app.get("/health", (req, res) => {
	res.status(200).send("Ok")
})

app.get("/pictures", async (req, res) => {
	const data = await knex("pictures").select("*").where({ is_hidden: false })

	res.json(data)
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

		res.status(200).json({})
		return
	}

	res.status(200).json({})
})

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