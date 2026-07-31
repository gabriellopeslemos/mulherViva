# ---- Web (static build served by nginx) ----

# Stage 1: build the bundle.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# `npm ci` installs exactly what the lockfile pins, so the image is reproducible.
RUN npm ci

COPY . .

# VITE_* values are baked into the bundle at build time, so they must be
# supplied here rather than at container start.
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# Stage 2: serve. Only the built assets ship — no node_modules, no sources.
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
