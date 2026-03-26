import bodyParser from "body-parser"
import cors from "cors"
import express, { Request } from "express"
import ViteExpress from "vite-express"
import { v4 } from "uuid"
import { handleAdmin } from "./admin"
import { knex } from "./database"
import { cacheData } from "./cache"
import { handleEvents, getActiveEvent } from "./events"

const app = express()
const port = process.env.PORT || 5000
const imgBasePath = process.env.IMG_BASE_PATH
const tusdPath = process.env.TUSD_PATH || ""

// HTML transformer to inject server config into the frontend
function transformer(html: string, _req: Request): string {
	const appData = {
		TUSD_PATH: tusdPath,
	}

	const script = `<script>window.__APP_DATA__ = ${JSON.stringify(appData)}</script>`

	// Inject script at the end of <head>
	return html.replace("</head>", `${script}</head>`)
}

// Configure vite-express for monorepo setup (using class-based API from patch)
const viteExpress = new ViteExpress()
viteExpress.config({
	mode: process.env.NODE_ENV === "production" ? "production" : "development",
	inlineViteConfig: {
		root: `${__dirname}/../../../apps/web`,
		build: { outDir: "dist" },
		envDir: `${__dirname}/../../../`,
	} as any,
	transformer,
})

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get("/health", (req, res) => {
	res.status(200).send("Ok")
})

// Get pictures for a specific event by slug
app.get("/pictures/:eventSlug", async (req, res) => {
	const { eventSlug } = req.params

	// Find the event by slug
	const event = await knex("events").where({ slug: eventSlug }).first()
	if (!event) {
		res.status(404).json({ error: "Event not found" })
		return
	}

	const data = await knex("pictures")
		.select("*")
		.where({ is_hidden: false, is_cached: true, event_id: event.id })
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

// Legacy endpoint - get all pictures (deprecated, for backward compatibility)
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

		// Check if there's an active event accepting uploads
		const activeEvent = await getActiveEvent()
		if (!activeEvent) {
			res.status(200).json({
				RejectUpload: true,
				HTTPResponse: {
					StatusCode: 403,
					Body: JSON.stringify({ error: "No active event accepting uploads" }),
				},
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
		// Get the active event to associate with the picture
		const activeEvent = await getActiveEvent()

		await knex("pictures").insert({
			name: req.body.Event.Upload.MetaData.filename,
			file_path: req.body.Event.Upload.Storage.Key,
			is_hidden: false,
			event_id: activeEvent?.id || null,
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
handleEvents(app)

const server = app.listen(Number(port), () => {
	viteExpress.bind(app, server, () => {
		console.log(new Date(), `Server Listening on port ${port}`)
	})
})

function ignore() {}

process.once("SIGINT", () => {
	// Ignore further SIGINT signals whilst we're processing
	process.on("SIGINT", ignore)
	process.kill(process.pid, "SIGINT")
	process.exit(1)
})
