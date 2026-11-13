# syntax=docker/dockerfile:1

# ---- Build: install dependencies, run tests, produce static files in /app/dist ----
FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
# A failing test or type error stops the image build.
RUN npm test && npm run build

# ---- Runtime: serve the static files with nginx as a non-root user ----
FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
