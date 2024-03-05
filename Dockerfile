FROM node:20-alpine as deps
# Import our shared args
ARG NODE_ENV
ARG ROOT_URL
ARG NEXT_PUBLIC_TUSD_PATH

WORKDIR /app/

# # Cache node_modules for as long as possible
COPY package.json yarn.lock turbo.json .gitignore /app/
COPY apps/server/package.json /app/apps/server/package.json
COPY apps/web/package.json /app/apps/web/package.json

COPY packages/typescript-config/ /app/packages/typescript-config/
COPY packages/eslint-config/ /app/packages/eslint-config/

RUN yarn install

COPY knexfile.ts /app/

# ============================================================================ #
# ============================================================================ #
# ============================================================================ #
FROM deps as server

COPY apps/server/ /app/apps/server/
RUN cd apps/server && yarn build

# ============================================================================ #
# ============================================================================ #
# ============================================================================ #
FROM deps as frontend

COPY apps/web/ /app/apps/web/
RUN cd apps/web && yarn build

# # ============================================================================ #
# # ============================================================================ #
# # ============================================================================ #
FROM node:20-alpine

WORKDIR /app/

ENV NODE_ENV=production

COPY --from=deps /app /app

COPY --from=server /app/apps/server/dist /app/apps/server/dist
COPY /apps/server/migrations /app/apps/server/migrations

COPY --from=frontend /app/apps/web/out /app/apps/web/out

ENTRYPOINT yarn migrate && node /app/apps/server/dist/apps/server/src/index.js