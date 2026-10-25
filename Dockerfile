FROM node:24.19.0-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies

RUN npm install --global pnpm@11.20.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Server modules validate environment variables during the build. These temporary
# values need no database and are replaced by the container's runtime environment.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/qurban \
    BETTER_AUTH_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(48).toString("base64url"))')" \
    BETTER_AUTH_URL="${NEXT_PUBLIC_APP_URL}" \
    pnpm build

FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
