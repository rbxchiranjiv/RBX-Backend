# RBx Backend Stage 1 Dockerfile
FROM node:18-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
