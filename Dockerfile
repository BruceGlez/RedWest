# Red West economy server (server/), for Coolify or any Docker host. See docs/DEPLOY.md.
# The server has no npm dependencies: it needs only server/ and the pure rules in src/ that it imports.
# The web game itself is a static build (npm run build) and is hosted separately (GitHub Pages today).
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_FILE=/data/redwest.json

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY src ./src

# Non-root user; /data is the volume that holds the player data until Postgres replaces the JSON file.
RUN addgroup -S redwest && adduser -S redwest -G redwest \
    && mkdir -p /data && chown redwest:redwest /data
USER redwest
VOLUME /data

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server/index.js"]
