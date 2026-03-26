import dotenv from "dotenv"
import path from "path"

// Load .env from project root
// In production (compiled), __dirname is /app/apps/server/dist/apps/server/src
// In development, __dirname is /app/apps/server/src
const envPath =
	process.env.NODE_ENV === "production"
		? path.resolve(__dirname, "../../../../../.env")
		: path.resolve(__dirname, "../../../.env")
dotenv.config({ path: envPath })

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
const imgBasePath = process.env.IMG_BASE_PATH || ""
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
// In production (compiled), __dirname is /app/apps/server/dist/apps/server/src
// In development, __dirname is /app/apps/server/src
// We need to handle both cases for the web app path
const isProduction = process.env.NODE_ENV === "production"
const webAppRoot = isProduction
	? `${__dirname}/../../../../../web` // From dist/apps/server/src up 5 to /app/apps, then web
	: `${__dirname}/../../web` // From apps/server/src -> apps/web

const viteExpress = new ViteExpress()
viteExpress.config({
	mode: isProduction ? "production" : "development",
	inlineViteConfig: {
		root: webAppRoot,
		build: { outDir: "dist" },
		envDir: isProduction
			? `${__dirname}/../../../../../`
			: `${__dirname}/../../../`,
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
	const sort = (req.query.sort as string) || "photo_date" // "photo_date" or "upload_date"

	// Find the event by slug
	const event = await knex("events").where({ slug: eventSlug }).first()
	if (!event) {
		res.status(404).json({ error: "Event not found" })
		return
	}

	const orderByColumn =
		sort === "upload_date" ? "created_at" : "exif_created_at"
	const data = await knex("pictures")
		.select("*")
		.where({ is_hidden: false, is_cached: true, event_id: event.id })
		.orderBy(orderByColumn, "desc")

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
		const filename = req.body.Event.Upload.MetaData.filename
		const fileType = req.body.Event.Upload.MetaData.type

		if (!fileType.startsWith("image")) {
			console.log(new Date(), `[upload] Rejected ${filename}: not an image`)
			res.status(200).json({ RejectUpload: true })
			return
		}

		const activeEvent = await getActiveEvent()
		if (!activeEvent) {
			console.log(new Date(), `[upload] Rejected ${filename}: no active event`)
			res.status(200).json({
				RejectUpload: true,
				HTTPResponse: {
					StatusCode: 403,
					Body: JSON.stringify({ error: "No active event accepting uploads" }),
				},
			})
			return
		}

		const newId = `${v4()}.${extension}`
		res.status(200).json({ ChangeFileInfo: { ID: newId } })
		return
	}

	if (req.body.Type === "post-finish") {
		const filename = req.body.Event.Upload.MetaData.filename
		const storageKey = req.body.Event.Upload.Storage.Key
		const activeEvent = await getActiveEvent()

		await knex("pictures").insert({
			name: filename,
			file_path: storageKey,
			is_hidden: false,
			event_id: activeEvent?.id || null,
			created_at: new Date(),
			updated_at: new Date(),
		})

		await cacheData(storageKey)
		console.log(
			new Date(),
			`[upload] ${filename} -> ${storageKey} (event: ${activeEvent?.name || "none"})`,
		)

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
