FROM node:22-alpine AS client-build
WORKDIR /app

COPY client/package*.json ./client/
RUN npm ci --prefix client
COPY client ./client
RUN npm run build --prefix client

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix server
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist

USER node
EXPOSE 3001
CMD ["npm", "run", "start", "--prefix", "server"]
