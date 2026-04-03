# ── Stage 1: Build React client ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Install client deps first (layer cache)
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy source and build
COPY client ./client
RUN cd client && npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Install only production backend deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server and built frontend
COPY server.js ./
COPY --from=builder /build/client/dist ./client/dist

EXPOSE 4895

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4895/api/providers/list || exit 1

CMD ["node", "server.js"]
