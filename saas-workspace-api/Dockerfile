# ─────────────────────────────────────────────────────────────
# Dockerfile — SaaS Team Workspace API
# Multi-stage build for lean production image
#
# NOTE: Uses node:20-slim (Debian) instead of alpine.
# Alpine uses musl libc which causes Prisma engine download failures.
# node:20-slim has OpenSSL pre-installed and uses glibc — fully
# compatible with Prisma's prebuilt binaries.
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ──────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

# Install OpenSSL (required by Prisma query engine)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy only package files first for layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (needed for prisma generate)
# Using npm install instead of npm ci since no package-lock.json is committed
RUN npm install

# Generate Prisma client for the correct platform
RUN npx prisma generate


# ── Stage 2: Production Image ──────────────────────────────────
FROM node:20-slim AS production

# Install OpenSSL runtime (Prisma query engine links against it)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set non-root user for security
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /bin/sh nodejs

WORKDIR /app

# Copy node_modules and prisma client from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/prisma ./prisma

# Copy application source
COPY --chown=nodejs:nodejs . .

# Use non-root user
USER nodejs

# Expose app port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Run database migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
