import { Express } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";

import { knex } from "./database";

// Note: imgBasePath is a getter function because this module is imported
// before dotenv.config() is called in index.ts
const getImgBasePath = () => process.env.IMG_BASE_PATH || "";

// Configure multer for background image uploads
const getUploadPath = () => {
  const isProduction = process.env.NODE_ENV === "production";
  // Store in /uploads at project root
  return isProduction
    ? path.resolve(__dirname, "../../../../../../uploads")
    : path.resolve(__dirname, "../../../uploads");
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = getUploadPath();
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `bg-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

const eventUpload = upload.fields([
  { name: "background_image", maxCount: 1 },
  { name: "logo", maxCount: 1 },
]);

// Helper to format date for datetime-local input
const formatDateForInput = (date: string | null) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 16);
};

// Helper to check if event is active
const isEventActive = (startTime: string, endTime: string) => {
  const now = new Date();
  return new Date(startTime) <= now && new Date(endTime) >= now;
};

// Helper to check if event has ended
const isEventEnded = (endTime: string) => {
  return new Date(endTime) < new Date();
};

export const handleAdmin = (app: Express) => {
  // Toggle picture visibility
  app.post("/admin/hide", async (req, res) => {
    const data = await knex("pictures")
      .select("is_hidden")
      .where({ id: req.body.id });

    await knex("pictures")
      .update({ is_hidden: !data[0].is_hidden })
      .where({ id: req.body.id });

    res.send("Ok");
  });

  // Create event
  app.post("/admin/events/create", eventUpload as any, async (req, res) => {
    const {
      name,
      slug,
      location,
      event_start_time,
      event_end_time,
      start_time,
      end_time,
    } = req.body;

    if (!name || !slug || !start_time || !end_time) {
      res.status(400).send("Missing required fields");
      return;
    }

    // Check if slug already exists
    const existing = await knex("events").where({ slug }).first();
    if (existing) {
      res.status(400).send("Slug already exists");
      return;
    }

    // Get uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const backgroundImage = files?.background_image?.[0]
      ? `/uploads/${files.background_image[0].filename}`
      : null;
    const logo = files?.logo?.[0] ? `/uploads/${files.logo[0].filename}` : null;

    await knex("events").insert({
      name,
      slug,
      location: location || null,
      event_start_time: event_start_time
        ? new Date(event_start_time).toISOString()
        : null,
      event_end_time: event_end_time
        ? new Date(event_end_time).toISOString()
        : null,
      start_time: new Date(start_time).toISOString(),
      end_time: new Date(end_time).toISOString(),
      background_image: backgroundImage,
      logo: logo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.redirect("/admin/events");
  });

  // Helper to handle file removal
  const deleteUploadedFile = (filePath: string | null) => {
    if (!filePath) return;
    const filename = filePath.replace(/^\/uploads\//, "");
    const fullPath = path.join(getUploadPath(), filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  };

  // Update event
  app.post("/admin/events/update/:id", eventUpload as any, async (req, res) => {
    const { id } = req.params;
    const {
      name,
      slug,
      location,
      event_start_time,
      event_end_time,
      start_time,
      end_time,
      remove_background,
      remove_logo,
    } = req.body;

    // Check if event exists
    const existing = await knex("events").where({ id }).first();
    if (!existing) {
      res.status(404).send("Event not found");
      return;
    }

    // Check if slug is taken by another event
    if (slug !== existing.slug) {
      const slugExists = await knex("events")
        .where({ slug })
        .whereNot({ id })
        .first();
      if (slugExists) {
        res.status(400).send("Slug already exists");
        return;
      }
    }

    // Get uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Handle background image
    let backgroundImage = existing.background_image;
    if (files?.background_image?.[0]) {
      deleteUploadedFile(existing.background_image);
      backgroundImage = `/uploads/${files.background_image[0].filename}`;
    } else if (remove_background === "1") {
      deleteUploadedFile(existing.background_image);
      backgroundImage = null;
    }

    // Handle logo
    let logo = existing.logo;
    if (files?.logo?.[0]) {
      deleteUploadedFile(existing.logo);
      logo = `/uploads/${files.logo[0].filename}`;
    } else if (remove_logo === "1") {
      deleteUploadedFile(existing.logo);
      logo = null;
    }

    await knex("events")
      .where({ id })
      .update({
        name,
        slug,
        location: location || null,
        event_start_time: event_start_time
          ? new Date(event_start_time).toISOString()
          : null,
        event_end_time: event_end_time
          ? new Date(event_end_time).toISOString()
          : null,
        start_time: new Date(start_time).toISOString(),
        end_time: new Date(end_time).toISOString(),
        background_image: backgroundImage,
        logo: logo,
        updated_at: new Date().toISOString(),
      });

    res.redirect("/admin/events");
  });

  // Delete event
  app.post("/admin/events/delete/:id", async (req, res) => {
    const { id } = req.params;

    // Check if event has pictures
    const pictureCount = await knex("pictures")
      .where({ event_id: id })
      .count("id as count")
      .first();

    if (pictureCount && (pictureCount.count as number) > 0) {
      res
        .status(400)
        .send("Cannot delete event with pictures. Remove pictures first.");
      return;
    }

    await knex("events").where({ id }).delete();
    res.redirect("/admin/events");
  });

  // Admin events management page
  app.get("/admin/events", async (req, res) => {
    const events = await knex("events")
      .select("*")
      .orderBy("start_time", "desc");

    // Get picture count for each event
    const eventPictureCounts = await knex("pictures")
      .select("event_id")
      .count("id as count")
      .groupBy("event_id");

    const pictureCountMap: Record<number, number> = {};
    eventPictureCounts.forEach((row: any) => {
      if (row.event_id) {
        pictureCountMap[row.event_id] = row.count as number;
      }
    });

    const formattedEvents = events.map((e) => ({
      ...e,
      pictureCount: pictureCountMap[e.id] || 0,
      isActive: isEventActive(e.start_time, e.end_time),
      isEnded: isEventEnded(e.end_time),
    }));

    res.send(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Admin - Events</title>
				<script src="https://unpkg.com/htmx.org@1.9.10" integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC" crossorigin="anonymous"></script>
				<style>
					body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
					.container { max-width: 1200px; margin: 0 auto; }
					h1 { color: #333; }
					.nav { margin-bottom: 20px; }
					.nav a { margin-right: 15px; color: #0066cc; text-decoration: none; }
					.nav a:hover { text-decoration: underline; }
					.card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
					.form-group { margin-bottom: 15px; }
					.form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
					.form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
					.btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
					.btn-primary { background: #0066cc; color: white; }
					.btn-danger { background: #dc3545; color: white; }
					.btn-secondary { background: #6c757d; color: white; }
					.btn:hover { opacity: 0.9; }
					.event-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
					.event-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
					.event-status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; margin-bottom: 10px; }
					.status-active { background: #28a745; color: white; }
					.status-ended { background: #dc3545; color: white; }
					.status-upcoming { background: #ffc107; color: #333; }
					.event-name { font-size: 18px; font-weight: 600; margin-bottom: 5px; }
					.event-slug { color: #666; font-size: 14px; margin-bottom: 10px; }
					.event-dates { font-size: 14px; color: #555; margin-bottom: 10px; }
					.event-pics { font-size: 14px; color: #666; margin-bottom: 15px; }
					.event-actions { display: flex; gap: 10px; flex-wrap: wrap; }
					details { margin-top: 10px; }
					summary { cursor: pointer; color: #0066cc; }
					.edit-form { margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="nav">
						<a href="/admin">Pictures</a>
						<a href="/admin/events">Events</a>
					</div>
					
					<h1>Event Management</h1>
					
					<div class="card">
						<h2>Create New Event</h2>
						<form action="/admin/events/create" method="POST" enctype="multipart/form-data">
							<div class="form-group">
								<label>Event Name</label>
								<input type="text" name="name" required placeholder="e.g., Hope Fest UK 2025" />
							</div>
							<div class="form-group">
								<label>URL Slug</label>
								<input type="text" name="slug" required placeholder="e.g., hopefest-2025" pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only" />
							</div>
							<div class="form-group">
								<label>Location (optional)</label>
								<input type="text" name="location" placeholder="e.g., ExCeL London" />
							</div>
							<div class="form-group">
								<label>Logo (optional)</label>
								<input type="file" name="logo" accept="image/*" />
							</div>
							<div class="form-group">
								<label>Background Image (optional)</label>
								<input type="file" name="background_image" accept="image/*" />
							</div>
							<h4 style="margin-top: 20px; margin-bottom: 10px; color: #555;">Event Times (displayed to users)</h4>
							<div class="form-group">
								<label>Event Start Time (optional)</label>
								<input type="datetime-local" name="event_start_time" />
							</div>
							<div class="form-group">
								<label>Event End Time (optional)</label>
								<input type="datetime-local" name="event_end_time" />
							</div>
							<h4 style="margin-top: 20px; margin-bottom: 10px; color: #555;">Upload Window (when photos can be uploaded)</h4>
							<div class="form-group">
								<label>Upload Opens</label>
								<input type="datetime-local" name="start_time" required />
							</div>
							<div class="form-group">
								<label>Upload Closes</label>
								<input type="datetime-local" name="end_time" required />
							</div>
							<button type="submit" class="btn btn-primary">Create Event</button>
						</form>
					</div>
					
					<h2>All Events</h2>
					<div class="event-grid">
						${formattedEvents
              .map(
                (event) => `
							<div class="event-card">
								<span class="event-status ${event.isActive ? "status-active" : event.isEnded ? "status-ended" : "status-upcoming"}">
									${event.isActive ? "Active" : event.isEnded ? "Ended" : "Upcoming"}
								</span>
								<div class="event-name">${event.name}</div>
								<div class="event-slug">/${event.slug}</div>
								${event.location ? `<div style="font-size: 14px; color: #666; margin-bottom: 5px;">📍 ${event.location}</div>` : ""}
								${event.event_start_time ? `<div style="font-size: 14px; color: #555; margin-bottom: 5px;"><strong>Event:</strong> ${new Date(event.event_start_time).toLocaleString()}${event.event_end_time ? ` - ${new Date(event.event_end_time).toLocaleString()}` : ""}</div>` : ""}
								<div class="event-dates">
									<strong>Uploads:</strong> ${new Date(event.start_time).toLocaleString()} - ${new Date(event.end_time).toLocaleString()}
								</div>
								<div class="event-pics">${event.pictureCount} pictures</div>
								
								<div class="event-actions">
									<a href="/admin/pictures/${event.id}" class="btn btn-secondary">View Pictures</a>
									${
                    event.pictureCount === 0
                      ? `
										<form action="/admin/events/delete/${event.id}" method="POST" style="display:inline;" onsubmit="return confirm('Are you sure you want to delete this event?')">
											<button type="submit" class="btn btn-danger">Delete</button>
										</form>
									`
                      : ""
                  }
								</div>
								
								<details>
									<summary>Edit Event</summary>
									<form class="edit-form" action="/admin/events/update/${event.id}" method="POST" enctype="multipart/form-data">
										<div class="form-group">
											<label>Event Name</label>
											<input type="text" name="name" value="${event.name}" required />
										</div>
										<div class="form-group">
											<label>URL Slug</label>
											<input type="text" name="slug" value="${event.slug}" required pattern="[a-z0-9-]+" />
										</div>
										<div class="form-group">
											<label>Location</label>
											<input type="text" name="location" value="${event.location || ""}" />
										</div>
										<div class="form-group">
											<label>Logo</label>
											${event.logo ? `<div style="margin-bottom: 8px;"><img src="${event.logo}" style="max-width: 100px; max-height: 60px; border-radius: 4px; background: #1B2829; padding: 4px;" /><br><label style="font-weight: normal;"><input type="checkbox" name="remove_logo" value="1" /> Remove logo</label></div>` : ""}
											<input type="file" name="logo" accept="image/*" />
										</div>
										<div class="form-group">
											<label>Background Image</label>
											${event.background_image ? `<div style="margin-bottom: 8px;"><img src="${event.background_image}" style="max-width: 200px; max-height: 100px; border-radius: 4px;" /><br><label style="font-weight: normal;"><input type="checkbox" name="remove_background" value="1" /> Remove background</label></div>` : ""}
											<input type="file" name="background_image" accept="image/*" />
										</div>
										<h4 style="margin-top: 15px; margin-bottom: 10px; color: #555; font-size: 14px;">Event Times</h4>
										<div class="form-group">
											<label>Event Start Time</label>
											<input type="datetime-local" name="event_start_time" value="${formatDateForInput(event.event_start_time)}" />
										</div>
										<div class="form-group">
											<label>Event End Time</label>
											<input type="datetime-local" name="event_end_time" value="${formatDateForInput(event.event_end_time)}" />
										</div>
										<h4 style="margin-top: 15px; margin-bottom: 10px; color: #555; font-size: 14px;">Upload Window</h4>
										<div class="form-group">
											<label>Upload Opens</label>
											<input type="datetime-local" name="start_time" value="${formatDateForInput(event.start_time)}" required />
										</div>
										<div class="form-group">
											<label>Upload Closes</label>
											<input type="datetime-local" name="end_time" value="${formatDateForInput(event.end_time)}" required />
										</div>
										<button type="submit" class="btn btn-primary">Update Event</button>
									</form>
								</details>
							</div>
						`,
              )
              .join("")}
					</div>
					
					${formattedEvents.length === 0 ? "<p>No events yet. Create your first event above.</p>" : ""}
				</div>
			</body>
			</html>
		`);
  });

  // Admin pictures page (updated to support filtering by event)
  app.get("/admin/pictures/:eventId?", async (req, res) => {
    const { eventId } = req.params;
    const sort = (req.query.sort as string) || "photo_date"; // "photo_date" or "upload_date"

    const orderByColumn =
      sort === "upload_date"
        ? "pictures.created_at"
        : "pictures.exif_created_at";

    let query = knex("pictures")
      .select(
        "pictures.*",
        "events.name as event_name",
        "events.slug as event_slug",
      )
      .leftJoin("events", "pictures.event_id", "events.id")
      .orderBy(orderByColumn, "desc");

    if (eventId) {
      query = query.where({ event_id: eventId });
    }

    const data = await query;

    // Get all events for the dropdown
    const events = await knex("events")
      .select("*")
      .orderBy("start_time", "desc");

    const formatted = data.map((x) => {
      const fileSplit = x.file_path.split(".");
      const fileName = fileSplit[fileSplit.length - 2];
      const fileExtension = fileSplit[fileSplit.length - 1];
      return {
        id: x.id,
        src: `${getImgBasePath()}${fileName}-320.${fileExtension}`,
        isHidden: x.is_hidden,
        createdAt: x.created_at,
        eventName: x.event_name || "No Event",
        eventSlug: x.event_slug,
      };
    });

    res.send(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Admin - Pictures</title>
				<script src="https://unpkg.com/htmx.org@1.9.10" integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC" crossorigin="anonymous"></script>
				<style>
					body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
					.container { max-width: 1400px; margin: 0 auto; }
					h1 { color: #333; }
					.nav { margin-bottom: 20px; }
					.nav a { margin-right: 15px; color: #0066cc; text-decoration: none; }
					.nav a:hover { text-decoration: underline; }
					.filter-bar { margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
					.filter-bar select { padding: 8px; font-size: 14px; }
					.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
					.pic-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
					.pic-card img { width: 100%; display: block; }
					.pic-info { padding: 10px; }
					.pic-event { font-size: 12px; color: #666; margin-bottom: 5px; }
					.pic-actions { display: flex; align-items: center; gap: 10px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="nav">
						<a href="/admin/pictures">All Pictures</a>
						<a href="/admin/events">Events</a>
					</div>
					
					<h1>Pictures ${eventId ? `for Event #${eventId}` : "(All)"}</h1>
					
					<div class="filter-bar">
						<label>Filter by Event: </label>
						<select onchange="updateUrl()">
							<option value="">All Events</option>
							${events
                .map(
                  (e) => `
								<option value="${e.id}" ${eventId == e.id ? "selected" : ""}>${e.name}</option>
							`,
                )
                .join("")}
						</select>
						
						<label style="margin-left: 20px;">Sort by: </label>
						<select id="sortSelect" onchange="updateUrl()">
							<option value="photo_date" ${sort === "photo_date" ? "selected" : ""}>Photo Date</option>
							<option value="upload_date" ${sort === "upload_date" ? "selected" : ""}>Upload Date</option>
						</select>
						
						<script>
							function updateUrl() {
								const eventSelect = document.querySelector('.filter-bar select:first-of-type');
								const sortSelect = document.getElementById('sortSelect');
								const eventId = eventSelect.value;
								const sort = sortSelect.value;
								let url = eventId ? '/admin/pictures/' + eventId : '/admin/pictures';
								if (sort !== 'photo_date') {
									url += '?sort=' + sort;
								}
								window.location.href = url;
							}
						</script>
					</div>
					
					<div class="grid">
						${formatted
              .map(
                (x) => `
							<div class="pic-card">
								<img src="${x.src}" alt="" />
								<div class="pic-info">
									<div class="pic-event">${x.eventName}</div>
									<div class="pic-actions">
										<input autocomplete="off" type="checkbox" hx-post="/admin/hide" hx-vals='{"id": ${x.id}}' ${x.isHidden ? "checked" : ""} />
										<label>Hidden</label>
									</div>
								</div>
							</div>
						`,
              )
              .join("")}
					</div>
					
					${formatted.length === 0 ? "<p>No pictures found.</p>" : ""}
				</div>
			</body>
			</html>
		`);
  });

  // Legacy admin route - redirect to pictures
  app.get("/admin", async (req, res) => {
    res.redirect("/admin/pictures");
  });
};
