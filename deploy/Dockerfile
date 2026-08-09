# Build de la SPA + nginx que la sirve y hace de proxy hacia PocketBase.
# El VPS no tiene node instalado: todo el build ocurre acá.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public

# Mismo origen que el sitio publicado: nginx enruta /api y /_/ a PocketBase.
ARG VITE_PB_URL=https://scopes.jpreyes.cl
ENV VITE_PB_URL=$VITE_PB_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
