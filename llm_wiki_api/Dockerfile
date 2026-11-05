# ---- Build: dependencies, Prisma client, compilation ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.16.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate --config prisma7.config.ts && pnpm run build

# ---- Runtime ----
FROM node:24-bookworm-slim
WORKDIR /app
# curl: used by the healthcheck and by the seed script.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    FILES_DIR=/app/data \
    PORT=3000

# node_modules is kept whole: the Prisma CLI (a dev dependency) is needed
# to apply the migrations when the container starts.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma7.config.ts ./
COPY prisma ./prisma
# Wiki schema and sample sources. data/wiki/ is NOT copied (see .dockerignore):
# the pages are generated inside the container and are not kept in a volume.
COPY data ./data
COPY docker/entrypoint.sh docker/seed.sh ./docker/
RUN chmod +x docker/*.sh

EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=10 \
  CMD curl -fs http://localhost:3000/files/wiki > /dev/null || exit 1
ENTRYPOINT ["./docker/entrypoint.sh"]
