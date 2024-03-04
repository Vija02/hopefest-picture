FROM node:20-alpine as deps
# Import our shared args
ARG NODE_ENV
ARG ROOT_URL

WORKDIR /app/

# # Cache node_modules for as long as possible
COPY package.json yarn.lock turbo.json .gitignore /app/
COPY packages/ui/package.json /app/packages/ui/package.json
COPY apps/server/package.json /app/apps/server/package.json
COPY apps/web/package.json /app/apps/web/package.json

COPY packages/typescript-config/ /app/packages/typescript-config/
COPY packages/eslint-config/ /app/packages/eslint-config/

RUN yarn install

# ============================================================================ #
# ============================================================================ #
# ============================================================================ #
FROM deps as server

COPY knexfile.ts /app/
COPY apps/server/ /app/apps/server/
RUN cd apps/server && yarn build

# # ============================================================================ #
# # ============================================================================ #
# # ============================================================================ #
FROM node:20-alpine

WORKDIR /app/

ENV NODE_ENV=production

COPY /apps/server/migrations /app/apps/server/migrations
COPY --from=server /app/ /app/

ENTRYPOINT yarn migrate && node /app/apps/server/dist/apps/server/src/index.js