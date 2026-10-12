FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/audio-sync/package.json packages/audio-sync/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3001 \
    API_INTERNAL_URL=http://127.0.0.1:3001

COPY --from=build /app /app
EXPOSE 3000
CMD ["npm", "start"]
