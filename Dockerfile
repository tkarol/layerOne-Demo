# The whole app (pages and backend) in one container, with no Cloudflare and no outside
# services: Node only, no npm packages. Everyone's data (people, PINs, decks, customers,
# history, settings) is kept in /app/data, so mount a volume there (docker-compose.yml does).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p data && chown node:node data
USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "src/node-server.js"]
