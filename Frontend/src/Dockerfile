# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
COPY .env ./

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then \
    npm ci --no-fund --no-audit || npm install --no-fund --no-audit; \
  else \
    npm install --no-fund --no-audit; \
  fi


FROM node:24-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
COPY .env ./

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY public ./public
COPY next.config.ts tsconfig.json eslint.config.mjs postcss.config.mjs ./
COPY next-env.d.ts ./

RUN --mount=type=cache,target=/app/.next/cache \
  npm run build


FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000

CMD ["npm", "run", "start"]
