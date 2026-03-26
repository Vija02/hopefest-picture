# HopeFest Pictures

A multi-event photo gallery app where users can upload photos during events.

## Architecture

- **Monorepo** using Turborepo with `apps/server` and `apps/web`
- **Backend**: Express server (`apps/server/src/index.ts`)
- **Frontend**: React + Vite + Chakra UI (`apps/web`)
- **Database**: SQLite via Knex (`apps/server/src/database.ts`)
- **File uploads**: TUS protocol via external tusd server, photos stored in S3
- **Background/logo uploads**: Multer, stored in `/uploads` folder

## Key Files

- `apps/server/src/index.ts` - Main server, routes, SSE, TUS webhook, HTML transformer
- `apps/server/src/admin.ts` - Admin panel (events + pictures management)
- `apps/server/src/events.ts` - Event CRUD API
- `apps/web/src/pages/EventGalleryPage.tsx` - Main gallery page
- `apps/web/src/pages/HomePage.tsx` - Event listing

## Database

Migrations in `apps/server/migrations/`. Run with `yarn knex migrate:latest`.

Key tables:

- `events` - name, slug, location, times, logo, background_image
- `pictures` - file_path, event_id, uploader_id, exif data

## Environment Variables

Set in `.env` at project root. Loaded via dotenv in `index.ts`.

- `IMG_BASE_PATH` - Base URL for serving images from S3
- `TUSD_PATH` - TUS server endpoint for uploads
- `AWS_*` - S3 credentials

## Development

```bash
yarn install
yarn dev
```

## Production Paths

In production, compiled JS is in `dist/apps/server/src/`. Paths use 6 levels up (`../../../../../../`) to reach project root.

## Docker

- `docker-compose-dev.yml` - Development
- `docker-compose-prod.yml` - Production
- Volumes: `./db:/app/db`, `./uploads:/app/uploads`
