# Hopefest Picture

[Link to running project](https://pics24.hopefest.co.uk/)

## Getting started
Everything is setup through docker so all we need is to get the compose file running.
There's a few required environment variables so we need to make sure those are provided. They should be all in the docker-compose file.

```bash
docker-compose -f docker-compose-dev.yml up -d --build
```

## Components

There's a few components at play here. As seen in the docker-compose file.
- `tusd` server
  - Used by our frontend to upload the images
  - The `tusd` server will upload the image and notify the backend
- B2 Backblaze storage
  - We store the images here. We use S3 for the API so we could also replace with another S3 compatible storage
- Cache (Cloudflare)
  - Infront the B2 storage is a CDN so everything is fast
- Our server
  - This stores the list of pictures, serving it to the frontend
  - It also listens from `tusd` whenever there's a new picture uploaded
- Frontend
  - Built and served as a static file through our server