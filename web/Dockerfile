# -----------------------------------------------------------------------------
# Multi-stage build for the Avant Regard marketing website (Next.js 14).
# Bypasses Zeabur's zbpack auto-builder because its mandatory
# `npm update -g npm` pre-step fails on the provider's broken base image
# (`Cannot find module 'promise-retry'`). Doing the whole pipeline ourselves
# gives us deterministic, reproducible builds regardless of the base image.
#
# NOTE: We intentionally do NOT declare `# syntax=docker/dockerfile:1` here.
# That directive forces BuildKit to pull the Dockerfile frontend image from
# Docker Hub, which routes through `dockerhub.zeabur.cloud` on Zeabur and
# occasionally fails with TLS handshake timeouts. This Dockerfile only uses
# classic syntax (multi-stage, --from, --chown) that the built-in parser
# already supports, so skipping the frontend pull makes builds more reliable.
# -----------------------------------------------------------------------------

# --- Stage 1: install production + dev deps from lockfile ---------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --prefer-offline

# --- Stage 2: compile Next.js --------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* env vars are inlined here at build time; Zeabur injects them
# from the Service Variables panel before `docker build` runs.
RUN npm run build

# --- Stage 3: slim runtime image ----------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Run as non-root for defense in depth.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

USER nextjs

# Zeabur injects PORT at runtime; `next start -p ${PORT:-3100}` picks it up.
CMD ["npm", "run", "start"]
