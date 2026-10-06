FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY public ./public
# Mode public : aucune donnée d'entreprise sur le serveur ; cache OCR dans /tmp (dossier inscriptible)
ENV PUBLIC=1 PORT=7860 TESS_CACHE=/tmp/tessdata
EXPOSE 7860
CMD ["node", "server.js"]
