FROM node:20 AS builder
WORKDIR /app

COPY package*.json ./
COPY common/package*.json common/
COPY server/package*.json server/
RUN npm ci

COPY common ./common
COPY server ./server
RUN npm run build:server

FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/package*.json ./

WORKDIR /app/server
RUN npm ci --omit=dev

RUN npx prisma generate

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start:server"]