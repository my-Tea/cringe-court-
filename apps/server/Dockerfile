# The CringeCourt court server (testnet/demo money only). Not verified on this
# build machine (no Docker here); docs/BACKEND.md says so.
# Build from the repository root:
#   docker build -f apps/server/Dockerfile -t cringe-court-server .
#   docker run -p 8787:8787 -v court-data:/data -e CC_CORS_ORIGINS=https://your.app cringe-court-server
FROM node:20.19-slim
WORKDIR /app
# Every workspace manifest, so `npm ci` matches the lockfile; only the server's tree is installed.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ai/package.json packages/ai/
COPY packages/audio/package.json packages/audio/
COPY packages/chain-client/package.json packages/chain-client/
COPY packages/core/package.json packages/core/
COPY packages/engine/package.json packages/engine/
COPY packages/modes-grand-jury/package.json packages/modes-grand-jury/
COPY packages/modes-solo/package.json packages/modes-solo/
COPY packages/modes-versus/package.json packages/modes-versus/
COPY packages/net/package.json packages/net/
COPY packages/scene/package.json packages/scene/
COPY packages/world-id/package.json packages/world-id/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --workspace @cringe-court/server --include-workspace-root
COPY packages/core packages/core
COPY packages/engine packages/engine
COPY packages/modes-versus packages/modes-versus
COPY packages/modes-grand-jury packages/modes-grand-jury
COPY packages/net packages/net
COPY apps/server apps/server
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 CC_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "apps/server/src/main.ts"]
