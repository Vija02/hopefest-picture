import { Express } from "express";

import { knex } from "./database";

export interface Event {
  id: number;
  name: string;
  slug: string;
  location: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  start_time: string;
  end_time: string;
  background_image: string | null;
  logo: string | null;
  created_at: string;
  updated_at: string;
}

export const handleEvents = (app: Express) => {
  // Get all events (for admin)
  app.get("/api/events", async (req, res) => {
    const events = await knex("events")
      .select("*")
      .orderBy("start_time", "desc");
    res.json(events);
  });

  // Get single event by slug (for public)
  app.get("/api/events/:slug", async (req, res) => {
    const event = await knex("events")
      .select("*")
      .where({ slug: req.params.slug })
      .first();

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.json(event);
  });

  // Get active events (currently accepting uploads)
  app.get("/api/events/status/active", async (req, res) => {
    const now = new Date().toISOString();
    const events = await knex("events")
      .select("*")
      .where("start_time", "<=", now)
      .where("end_time", ">=", now)
      .orderBy("start_time", "desc");

    res.json(events);
  });

  // Get pictures for an event with filtering options
  app.get("/api/events/:slug/pictures", async (req, res) => {
    const { slug } = req.params;
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string) || 3, 1),
      100,
    );
    const sort = (req.query.sort as string) || "random"; // "random" or "latest"
    const dimension = (req.query.dimension as string) || "all"; // "all", "landscape", "portrait"

    // Find the event by slug
    const event = await knex("events").where({ slug }).first();
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const imgBasePath = process.env.IMG_BASE_PATH || "";

    // Build query
    let query = knex("pictures")
      .select("*")
      .where({ is_hidden: false, is_cached: true, event_id: event.id });

    // Apply dimension filter
    if (dimension === "landscape") {
      query = query.whereRaw("width > height");
    } else if (dimension === "portrait") {
      query = query.whereRaw("width < height");
    }

    // Apply sorting
    if (sort === "latest") {
      query = query.orderBy("created_at", "desc");
    } else {
      // Random sort
      query = query.orderByRaw("RANDOM()");
    }

    // Apply limit
    query = query.limit(limit);

    const data = await query;

    const formatted = data.map((x: any) => ({
      id: x.id,
      src: `${imgBasePath}${x.file_path}`,
      size: { width: x.width, height: x.height },
      createdAt: x.created_at,
      exifCreatedAt: x.exif_created_at,
      uploaderId: x.uploader_id,
    }));

    res.json(formatted);
  });

  // Get all public events (visible on homepage - past and current)
  app.get("/api/events/status/public", async (req, res) => {
    const now = new Date().toISOString();
    const events = await knex("events")
      .select("*")
      .where("start_time", "<=", now)
      .orderBy("start_time", "desc");

    // Get picture counts for each event
    const pictureCounts = await knex("pictures")
      .select("event_id")
      .count("id as count")
      .where({ is_hidden: false, is_cached: true })
      .groupBy("event_id");

    const countMap: Record<number, number> = {};
    pictureCounts.forEach((row: any) => {
      if (row.event_id) {
        countMap[row.event_id] = Number(row.count);
      }
    });

    const eventsWithCounts = events.map((event: any) => ({
      ...event,
      picture_count: countMap[event.id] || 0,
    }));

    res.json(eventsWithCounts);
  });

  // Create event (admin)
  app.post("/api/events", async (req, res) => {
    const { name, slug, start_time, end_time } = req.body;

    if (!name || !slug || !start_time || !end_time) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Check if slug already exists
    const existing = await knex("events").where({ slug }).first();
    if (existing) {
      res.status(400).json({ error: "Slug already exists" });
      return;
    }

    const [id] = await knex("events").insert({
      name,
      slug,
      start_time,
      end_time,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const event = await knex("events").where({ id }).first();
    res.json(event);
  });

  // Update event (admin)
  app.put("/api/events/:id", async (req, res) => {
    const { name, slug, start_time, end_time } = req.body;
    const { id } = req.params;

    // Check if event exists
    const existing = await knex("events").where({ id }).first();
    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    // Check if slug is taken by another event
    if (slug !== existing.slug) {
      const slugExists = await knex("events")
        .where({ slug })
        .whereNot({ id })
        .first();
      if (slugExists) {
        res.status(400).json({ error: "Slug already exists" });
        return;
      }
    }

    await knex("events").where({ id }).update({
      name,
      slug,
      start_time,
      end_time,
      updated_at: new Date().toISOString(),
    });

    const event = await knex("events").where({ id }).first();
    res.json(event);
  });

  // Delete event (admin)
  app.delete("/api/events/:id", async (req, res) => {
    const { id } = req.params;

    // Check if event has pictures
    const pictureCount = await knex("pictures")
      .where({ event_id: id })
      .count("id as count")
      .first();

    if (pictureCount && (pictureCount.count as number) > 0) {
      res.status(400).json({
        error: "Cannot delete event with pictures. Remove pictures first.",
      });
      return;
    }

    await knex("events").where({ id }).delete();
    res.json({ success: true });
  });
};

// Helper function to check if an event is currently accepting uploads
export async function isEventAcceptingUploads(
  eventId: number,
): Promise<boolean> {
  const now = new Date().toISOString();
  const event = await knex("events")
    .where({ id: eventId })
    .where("start_time", "<=", now)
    .where("end_time", ">=", now)
    .first();

  return !!event;
}

// Helper function to get the current active event (for upload)
export async function getActiveEvent(): Promise<Event | null> {
  const now = new Date().toISOString();
  const event = await knex("events")
    .select("*")
    .where("start_time", "<=", now)
    .where("end_time", ">=", now)
    .orderBy("start_time", "desc")
    .first();

  return event || null;
}
