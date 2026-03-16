# Multi-stage build for notebooklm-client
#
# Usage:
#   docker build -t notebooklm .
#   docker run -v ~/.notebooklm:/root/.notebooklm notebooklm list --transport auto
#
# Supports: linux/amd64, linux/arm64

FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install curl (needed by setup-curl.ts to download curl-impersonate)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies + postinstall downloads curl-impersonate
COPY package*.json tsconfig.json ./
COPY scripts/ ./scripts/
RUN npm ci

# Verify curl-impersonate installed
RUN test -f bin/curl-impersonate && bin/curl-impersonate --version | head -1

# Build TypeScript
COPY src/ ./src/
RUN npx tsc

# ── Runtime ──

FROM node:22-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libnss3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production dependencies only (skip postinstall, we copy bin/ from builder)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built files + curl-impersonate binary + companion libs
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/bin ./bin/

# Session data mount point
VOLUME ["/root/.notebooklm"]

ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
