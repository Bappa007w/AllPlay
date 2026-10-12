# Local/container alternative only. Vercel uses the native services in vercel.json.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/audio-sync/package.json shared/audio-sync/package.json
COPY shared/contracts/package.json shared/contracts/package.json
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
