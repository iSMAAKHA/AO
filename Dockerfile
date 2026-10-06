FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY public ./public
ENV PUBLIC=1 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
