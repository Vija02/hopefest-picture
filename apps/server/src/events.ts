import { Express } from "express";
import { knex } from "./database";

export interface Event {
  id: number;
  name: string;
  slug: string;
  start_time: string;
  end_time: string;
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

  // Get all public events (visible on homepage - past and current)
  app.get("/api/events/status/public", async (req, res) => {
    const now = new Date().toISOString();
    const events = await knex("events")
      .select("*")
      .where("start_time", "<=", now)
      .orderBy("start_time", "desc");

    res.json(events);
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
