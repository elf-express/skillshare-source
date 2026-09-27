# ---- build stage ----
# Node major: team standard is 24.18 (elf-stack). docs-mcp-server currently uses node:26-alpine — see 待確認.
FROM node:<NODE_IMAGE_TAG> AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@<PNPM_VERSION> && pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ---- runtime stage ----
FROM node:<NODE_IMAGE_TAG>
WORKDIR /app
ENV NODE_ENV=production
ENV TRANSPORT=http
ENV PORT=<PORT>

# production deps only
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@<PNPM_VERSION> && pnpm install --prod --frozen-lockfile && pnpm store prune

# compiled server + bundled knowledge data
COPY --from=build /app/dist ./dist
COPY <data-dir> ./<data-dir>

EXPOSE <PORT>

# Optional: provide MCP_AUTH_TOKEN at runtime to require a bearer token.
#   docker run -e MCP_AUTH_TOKEN=your-secret -p <PORT>:<PORT> ghcr.io/elf-express/<server-name>
CMD ["node", "dist/index.js"]
