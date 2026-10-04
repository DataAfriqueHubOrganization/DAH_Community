# Image Debian (glibc) : le compilateur de Next.js (Turbopack) n'est pas
# pleinement pris en charge sur Alpine (musl).
FROM node:22-slim AS builder
WORKDIR /app
# Next.js inline les variables NEXT_PUBLIC_* dans le bundle au moment du build,
# pas au démarrage du conteneur — elles doivent donc arriver en build args.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY package*.json ./
RUN npm ci
COPY . .
# Adresse de l'API, figée dans le code du navigateur au moment du build.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
