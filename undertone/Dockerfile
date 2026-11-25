FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json schema.sql ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    CONNECTIONS_DIR=/app/connections
COPY --from=build /app/dist ./dist
COPY schema.sql ./
RUN mkdir -p /data /app/connections && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8787/System/Info/Public >/dev/null || exit 1
CMD ["node", "dist/server.mjs"]
