import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import path from "path";
import { v4 } from "uuid";
import ViteExpress from "vite-express";

import { handleAdmin } from "./admin";
import { cacheData } from "./cache";
import { knex } from "./database";
import { getActiveEvent, handleEvents } from "./events";

// Load .env from project root
// In production (compiled), __dirname is /app/apps/server/dist/apps/server/src
// In development, __dirname is /app/apps/server/src
const envPath =
  process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "../../../../../.env")
    : path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

const app = express();
const port = process.env.PORT || 5000;
const imgBasePath = process.env.IMG_BASE_PATH || "";
const tusdPath = process.env.TUSD_PATH || "";

// SSE clients storage - map of eventSlug to array of response objects
const sseClients: Map<string, Response[]> = new Map();

// Broadcast new picture to all clients watching a specific event
function broadcastNewPicture(eventSlug: string, picture: any) {
  const clients = sseClients.get(eventSlug) || [];
  const data = JSON.stringify({ type: "new_picture", picture });
  clients.forEach((client) => {
    client.write(`data: ${data}\n\n`);
  });
}

// HTML transformer to inject server config into the frontend
function transformer(html: string, _req: Request): string {
  const appData = {
    TUSD_PATH: tusdPath,
  };

  const script = `<script>window.__APP_DATA__ = ${JSON.stringify(appData)}</script>`;

  // Inject script at the end of <head>
  return html.replace("</head>", `${script}</head>`);
}

// Configure vite-express for monorepo setup (using class-based API from patch)
// In production (compiled), __dirname is /app/apps/server/dist/apps/server/src
// In development, __dirname is /app/apps/server/src
// We need to handle both cases for the web app path
const isProduction = process.env.NODE_ENV === "production";
const webAppRoot = isProduction
  ? `${__dirname}/../../../../../web` // From dist/apps/server/src up 5 to /app/apps, then web
  : `${__dirname}/../../web`; // From apps/server/src -> apps/web

const viteExpress = new ViteExpress();
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
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve uploaded files from /uploads
const uploadsPath = isProduction
  ? path.resolve(__dirname, "../../../../../../uploads")
  : path.resolve(__dirname, "../../../uploads");
app.use("/uploads", express.static(uploadsPath));

app.get("/health", (req, res) => {
  res.status(200).send("Ok");
});

// SSE endpoint for real-time updates
app.get("/events/:eventSlug/stream", async (req, res) => {
  const { eventSlug } = req.params;

  // Verify event exists
  const event = await knex("events").where({ slug: eventSlug }).first();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Add client to the list
  if (!sseClients.has(eventSlug)) {
    sseClients.set(eventSlug, []);
  }
  sseClients.get(eventSlug)!.push(res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  // Remove client on disconnect
  req.on("close", () => {
    const clients = sseClients.get(eventSlug) || [];
    const index = clients.indexOf(res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

// Get pictures for a specific event by slug
app.get("/pictures/:eventSlug", async (req, res) => {
  const { eventSlug } = req.params;
  const sort = (req.query.sort as string) || "photo_date"; // "photo_date" or "upload_date"

  // Find the event by slug
  const event = await knex("events").where({ slug: eventSlug }).first();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const orderByColumn =
    sort === "upload_date" ? "created_at" : "exif_created_at";
  const data = await knex("pictures")
    .select("*")
    .where({ is_hidden: false, is_cached: true, event_id: event.id })
    .orderBy(orderByColumn, "desc");

  const formatted = data.map((x) => {
    return {
      id: x.id,
      src: `${imgBasePath}${x.file_path}`,
      size: { width: x.width, height: x.height },
      createdAt: x.created_at,
      exifCreatedAt: x.exif_created_at,
      uploaderId: x.uploader_id,
    };
  });

  res.json(formatted);
});

// Legacy endpoint - get all pictures (deprecated, for backward compatibility)
app.get("/pictures", async (req, res) => {
  const data = await knex("pictures")
    .select("*")
    .where({ is_hidden: false, is_cached: true })
    .orderBy("exif_created_at", "desc");

  const formatted = data.map((x) => {
    return {
      id: x.id,
      src: `${imgBasePath}${x.file_path}`,
      size: { width: x.width, height: x.height },
      createdAt: x.created_at,
    };
  });

  res.json(formatted);
});

app.all("/tusd_notify", async (req, res) => {
  if (req.body.Type === "pre-create") {
    const filenameSplit = req.body.Event.Upload.MetaData.filename.split(".");
    const extension = filenameSplit[filenameSplit.length - 1];
    const filename = req.body.Event.Upload.MetaData.filename;
    const fileType = req.body.Event.Upload.MetaData.type;

    if (!fileType.startsWith("image")) {
      console.log(new Date(), `[upload] Rejected ${filename}: not an image`);
      res.status(200).json({ RejectUpload: true });
      return;
    }

    const activeEvent = await getActiveEvent();
    if (!activeEvent) {
      console.log(new Date(), `[upload] Rejected ${filename}: no active event`);
      res.status(200).json({
        RejectUpload: true,
        HTTPResponse: {
          StatusCode: 403,
          Body: JSON.stringify({ error: "No active event accepting uploads" }),
        },
      });
      return;
    }

    const newId = `${v4()}.${extension}`;
    res.status(200).json({ ChangeFileInfo: { ID: newId } });
    return;
  }

  if (req.body.Type === "post-finish") {
    const filename = req.body.Event.Upload.MetaData.filename;
    const storageKey = req.body.Event.Upload.Storage.Key;
    const uploaderId = req.body.Event.Upload.MetaData.uploaderId || null;
    const activeEvent = await getActiveEvent();

    const [insertedId] = await knex("pictures").insert({
      name: filename,
      file_path: storageKey,
      is_hidden: false,
      event_id: activeEvent?.id || null,
      uploader_id: uploaderId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await cacheData(storageKey);

    // Get the cached picture data and broadcast to SSE clients
    const picture = await knex("pictures").where({ id: insertedId }).first();
    if (picture && activeEvent) {
      broadcastNewPicture(activeEvent.slug, {
        id: picture.id,
        src: `${imgBasePath}${picture.file_path}`,
        size: { width: picture.width, height: picture.height },
        createdAt: picture.created_at,
        exifCreatedAt: picture.exif_created_at,
        uploaderId: picture.uploader_id,
      });
    }

    console.log(
      new Date(),
      `[upload] ${filename} -> ${storageKey} (event: ${activeEvent?.name || "none"})`,
    );

    res.status(200).json({});
    return;
  }

  res.status(200).json({});
});

handleAdmin(app);
handleEvents(app);

const server = app.listen(Number(port), () => {
  viteExpress.bind(app, server, () => {
    console.log(new Date(), `Server Listening on port ${port}`);
  });
});

function ignore() {}

process.once("SIGINT", () => {
  // Ignore further SIGINT signals whilst we're processing
  process.on("SIGINT", ignore);
  process.kill(process.pid, "SIGINT");
  process.exit(1);
});
