# Multi-stage build: curl-impersonate + Node.js runtime
# Provides Tier 1 fingerprint (100% Chrome TLS + HTTP/2) on all platforms via Docker.
#
# Usage:
#   docker build -t notebooklm .
#   docker run -v ~/.notebooklm:/root/.notebooklm notebooklm list --transport auto
#
# The container auto-detects curl-impersonate and uses it as Tier 1.

FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── Runtime ──

FROM node:22-bookworm-slim

# Install curl-impersonate (Chrome variant)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      libnss3 \
      wget && \
    # Download curl-impersonate prebuilt binaries
    ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then \
      CURL_URL="https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz"; \
    elif [ "$ARCH" = "arm64" ]; then \
      CURL_URL="https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.aarch64-linux-gnu.tar.gz"; \
    else \
      echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    wget -qO /tmp/curl-impersonate.tar.gz "$CURL_URL" && \
    tar xzf /tmp/curl-impersonate.tar.gz -C /usr/local/bin/ && \
    rm /tmp/curl-impersonate.tar.gz && \
    # Clean up
    apt-get remove -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Verify curl-impersonate is working
RUN curl_chrome116 --version

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built files
COPY --from=builder /app/dist ./dist

# Session data mount point
VOLUME ["/root/.notebooklm"]

ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
