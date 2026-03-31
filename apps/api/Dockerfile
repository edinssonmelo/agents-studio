# apps/api/Dockerfile

# ── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --frozen-lockfile

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: production ────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# SQLite DB directory
RUN mkdir -p /data/studio && chown appuser:appgroup /data/studio

USER appuser

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run migrations then start app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
