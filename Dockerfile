# syntax=docker/dockerfile:1

# ---- Build: install dependencies, run tests, produce static files in /app/dist ----
FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY index.html tsconfig.json vite.config.ts .env ./
COPY public ./public
COPY src ./src

# Optional overrides of the settings in .env (public site URL, source code URL, GA4 measurement ID).
ARG VITE_SITE_URL
ARG VITE_SOURCE_URL
ARG VITE_GA_ID
# Empty build args are unset so they do not override the defaults from .env.
# A failing test or type error stops the image build.
RUN [ -n "$VITE_SITE_URL" ] || unset VITE_SITE_URL; \
    [ -n "$VITE_SOURCE_URL" ] || unset VITE_SOURCE_URL; \
    [ -n "$VITE_GA_ID" ] || unset VITE_GA_ID; \
    npm test && npm run build

# ---- Runtime: serve the static files with nginx as a non-root user ----
FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
