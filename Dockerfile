# build
FROM node:16.15.0-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

RUN npm install --production

# run
FROM node:16.15.0-alpine
WORKDIR /app
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
