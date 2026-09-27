# docker/web.Dockerfile
# Build context is the repo root: docker compose -f docker/docker-compose.yml build
# Placeholders: <web-dir> (the web workspace, e.g. apps), <app> (config file name)
FROM node:24.18-alpine AS build
WORKDIR /repo

# Must match "packageManager": "pnpm@<PNPM_VERSION>" in the root package.json.
# Installed with npm, never corepack (team rule: no corepack anywhere).
ARG PNPM_VERSION=<PNPM_VERSION>
RUN npm install -g pnpm@${PNPM_VERSION}

# Manifests first so a source-only change does not re-run the install.
# pnpm-workspace.yaml is required: without it pnpm does not see the workspace
# packages and --frozen-lockfile fails. Add .npmrc here if the repo has one.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY <web-dir>/package.json <web-dir>/package.json
RUN pnpm install --frozen-lockfile

COPY <web-dir> <web-dir>

# Vite reads these at build time and bakes them into the bundle. Pointing at a
# relative /api keeps the browser same-origin, so nginx proxies to the API and
# no CORS negotiation is needed. Add further VITE_* build args the same way.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# The app defaults to the mock API when VITE_USE_MOCK is unset (code checks
# `!== 'false'`), which is right for local dev and CI e2e — and wrong for a
# production image. Default it OFF here; override only for a demo image.
ARG VITE_USE_MOCK=false
ENV VITE_USE_MOCK=$VITE_USE_MOCK

RUN pnpm run build

FROM nginx:alpine AS runtime
# Not named default.conf on purpose: the image's
# 10-listen-on-ipv6-by-default.sh entrypoint only runs when that exact file is
# present, and it shells out to `apk manifest nginx` to checksum it — which
# needs the Alpine package index and hangs the container start when the network
# is unavailable. Removing the stock file makes that script exit early; our
# config listens on IPv6 itself.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/<app>.conf
COPY --from=build /repo/<web-dir>/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
